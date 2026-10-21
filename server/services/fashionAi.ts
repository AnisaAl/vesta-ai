import Anthropic from '@anthropic-ai/sdk';
import { Message, type WardrobeItem } from "@shared/schema";
import { generateLocalFashionResponse } from "./fashionData";
import { trySmallTalkReply } from "./fashionSmallTalk";
import { searchDeepFashionDetailed } from "./deepFashion";
import { resolveOutfitSuggestions, type OutfitSource } from "./catalog";
import {
  FashionQueryPlan,
  buildRetrievalPlan,
  mergeMentorHintsForDisplay,
} from "./fashionIntent";
import {
  formatWardrobeInventory,
  selectWardrobeForChat,
} from "./wardrobe";
import type { FashionOutfit } from "../../client/src/lib/types";
import type { MatchQuality } from "./deepFashion";

const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY || "" 
});

let useLocalDataFallback = false;

function prepareConversationHistory(history: Message[]) {
  return history.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

const INTENT_APPENDIX: Record<FashionQueryPlan["intent"], string> = {
  combine:
    "COMBINE policy: recommend complementary categories only (never more of the same garment as the anchor). Prefer bottoms/shoes/bags for a top.",
  similar:
    "SIMILAR policy: stay on the same garment category as the anchor. Do not suggest complementary outfit pieces.",
  browse:
    "BROWSE policy: every card must be the named garment (e.g. all dresses). Do not mix in other categories. If needsFollowUp is true, ask one short clarifying question (men vs women and/or casual vs party/office) and leave outfits empty — do not invent products. Unstated color/style is optional; mention a palette in one sentence, never as swatch tiles.",
  color:
    "COLOR policy: name a concrete palette in one sentence (no swatch tiles). Image cards may be few or empty if the catalog lacks that color — say so rather than inventing looks.",
  style:
    "STYLE policy: stay on the requested vibe/occasion. Name the style tags you are following.",
  general:
    "GENERAL policy: balanced outfit advice; still respect audience if stated.",
};

function buildSystemPrompt(
  retrievalPlan: FashionQueryPlan,
  wardrobeInventory: string
): string {
  return `You are Vesta, a fashion mentor. Help users combine clothes, find similar pieces, choose colors, and refine style.

## Locked retrieval plan (do not change)
The server already classified this request. Your JSON MUST use these exact values:
- intent: ${retrievalPlan.intent}
- audience: ${retrievalPlan.audience}
- anchorGarment: ${retrievalPlan.anchorGarment}
- targetCategories: ${JSON.stringify(retrievalPlan.targetCategories)}
- colors (leave JSON colors as []; mention palettes only in the sentence above)
- styleTags (ok to refine for display): ${JSON.stringify(retrievalPlan.styleTags)}
${retrievalPlan.needsFollowUp ? "- needsFollowUp: true — ask the missing slots; do not describe specific products." : ""}

${INTENT_APPENDIX[retrievalPlan.intent]}

Never describe or imply men's catalog looks (gentleman, man, guy, his…) when audience is feminine, and the reverse for masculine.

## ${wardrobeInventory}

When the user asks about something they own, name those wardrobe pieces in prose. Closet items are never for sale — shoppable cards come only from the affiliate catalog (server-injected).

## Response format
Write a short human explanation, then ONE json code block:

\`\`\`json
{
  "intent": "${retrievalPlan.intent}",
  "audience": "${retrievalPlan.audience}",
  "anchorGarment": "${retrievalPlan.anchorGarment}",
  "targetCategories": ${JSON.stringify(retrievalPlan.targetCategories)},
  "colors": [],
  "styleTags": ${JSON.stringify(retrievalPlan.styleTags)},
  "outfits": [],
  "accessories": [],
  "conclusion": "Short wrap-up."
}
\`\`\`

Rules:
- outfits: ALWAYS leave as []. The server injects wardrobe (non-shoppable), affiliate products, or DeepFashion imagery (unless follow-up).
- Never invent Unsplash or other external image URLs.
- Never invent buy links for wardrobe pieces.
- colors: ALWAYS []. Mention navy/cream/etc. in the prose only — no swatch tiles.
- accessories: Remix Icon class names (ri-*) when helpful; else [].

## Image uploads
Describe the anchor item briefly, then follow the locked intent (combine vs similar).

## Tone
Concise, practical mentoring. For greetings and small talk, reply warmly in 1–2 sentences and ask what you can help with today. Never say you do not understand a greeting or chit-chat.`;
}

function extractJsonBlock(message: string): { json: any; raw: string } | null {
  const jsonMatch = message.match(/```json([\s\S]*?)```/);
  if (!jsonMatch) return null;
  try {
    return { json: JSON.parse(jsonMatch[1].trim()), raw: jsonMatch[0] };
  } catch {
    return null;
  }
}

function mentorHintsFromAssistant(
  assistantMessage: string
): Partial<FashionQueryPlan> | null {
  const parsed = extractJsonBlock(assistantMessage);
  if (!parsed) return null;
  const j = parsed.json;
  return {
    colors: Array.isArray(j.colors)
      ? j.colors
          .map((c: any) =>
            typeof c === "string" ? c : String(c?.name || "").toLowerCase()
          )
          .filter(Boolean)
      : undefined,
    styleTags: Array.isArray(j.styleTags) ? j.styleTags : undefined,
  };
}

async function injectOutfits(
  assistantMessage: string,
  retrievalPlan: FashionQueryPlan,
  displayPlan: FashionQueryPlan,
  userMessage: string,
  wardrobe: WardrobeItem[],
  limit = 4
): Promise<string> {
  const wardrobeOutfits = selectWardrobeForChat(
    wardrobe,
    retrievalPlan,
    userMessage,
    2
  );

  // Follow-up turns: still surface owned pieces, but do not inject shoppable catalog
  let catalogOutfits: FashionOutfit[] = [];
  let source: OutfitSource = "none";
  let match: MatchQuality = "empty";
  let categories: FashionQueryPlan["targetCategories"] = [];

  if (!retrievalPlan.needsFollowUp) {
    const catalogLimit = Math.max(1, limit - wardrobeOutfits.length);
    const resolved = await resolveOutfitSuggestions(
      retrievalPlan,
      catalogLimit,
      searchDeepFashionDetailed
    );
    catalogOutfits = resolved.outfits;
    source = resolved.source;
    match = resolved.match;
    categories = resolved.categories;
  }

  // Wardrobe first (owned, non-shoppable), then affiliate / DeepFashion
  const outfits: FashionOutfit[] = [...wardrobeOutfits, ...catalogOutfits].slice(
    0,
    limit
  );

  if (outfits.length === 0) {
    const hint =
      retrievalPlan.intent === "color"
        ? "I could not find catalog images matching that color yet; use the palette above and try another shade or a combine/similar ask."
        : "I could not find catalog or DeepFashion images for that filter yet; try rephrasing (e.g. “similar tops” or “pants to combine”).";
    return `${assistantMessage}\n\n${hint}`;
  }

  const parsed = extractJsonBlock(assistantMessage);
  const meta = {
    intent: retrievalPlan.intent,
    audience: retrievalPlan.audience,
    anchorGarment: retrievalPlan.anchorGarment,
    targetCategories: retrievalPlan.targetCategories,
    styleTags: displayPlan.styleTags,
    catalogSource: source,
    matchQuality: match,
    retrievedCategories: categories,
    wardrobeReferenced: wardrobeOutfits.length > 0,
    outfits,
  };

  if (parsed) {
    const next = {
      ...parsed.json,
      ...meta,
    };
    next.colors = [];
    return assistantMessage.replace(
      /```json[\s\S]*?```/,
      `\`\`\`json\n${JSON.stringify(next, null, 2)}\n\`\`\``
    );
  }

  return (
    assistantMessage +
    `\n\n\`\`\`json\n${JSON.stringify(
      {
        ...meta,
        colors: [],
        accessories: [],
        conclusion: "",
      },
      null,
      2
    )}\n\`\`\``
  );
}

function shouldAttachCatalog(plan: FashionQueryPlan, userMessage: string): boolean {
  if (plan.needsFollowUp) return false;
  if (["combine", "similar", "browse", "color", "style", "general"].includes(plan.intent)) {
    if (plan.intent === "general") {
      return /\b(outfit|clothes|clothing|wear|recommend|shirt|dress|pants|skirt|style)\b/i.test(
        userMessage
      );
    }
    return true;
  }
  return false;
}

/**
 * Generate fashion response using Anthropic Claude, optionally with image analysis.
 * Classify (heuristic + policy) drives retrieval; Claude mentors with a locked plan.
 * Wardrobe items (session closet) ground prose + non-shoppable cards; catalog stays affiliate.
 */
export async function generateFashionResponse(
  userMessage: string,
  history: Message[] = [],
  imageData?: string,
  wardrobe: WardrobeItem[] = []
) {
  const hasImage = Boolean(imageData);
  if (!hasImage) {
    const smallTalk = trySmallTalkReply(userMessage);
    if (smallTalk) {
      return { message: smallTalk, responseType: "text" };
    }
  }
  const priorUserTexts = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .filter(Boolean)
    .slice(-6);
  const retrievalPlan = buildRetrievalPlan(userMessage, hasImage, priorUserTexts);
  const wardrobeInventory = formatWardrobeInventory(wardrobe);

  if (useLocalDataFallback) {
    const localResponse = await generateLocalFashionResponse(
      userMessage,
      hasImage,
      priorUserTexts
    );
    let formattedResponse = localResponse.message;
    const wardrobeOutfits = selectWardrobeForChat(
      wardrobe,
      retrievalPlan,
      userMessage,
      2
    );
    const outfits = [
      ...wardrobeOutfits,
      ...(localResponse.outfits || []),
    ].slice(0, 4);
    if (outfits.length || localResponse.accessories) {
      formattedResponse +=
        "\n\n```json\n" +
        JSON.stringify(
          {
            intent: retrievalPlan.intent,
            audience: retrievalPlan.audience,
            anchorGarment: retrievalPlan.anchorGarment,
            targetCategories: retrievalPlan.targetCategories,
            colors: [],
            styleTags: retrievalPlan.styleTags,
            outfits,
            accessories: localResponse.accessories || [],
            wardrobeReferenced: wardrobeOutfits.length > 0,
          },
          null,
          2
        ) +
        "\n```";
    }
    return { message: formattedResponse, responseType: "text" };
  }

  try {
    const conversationHistory = prepareConversationHistory(history);
    let messages: any[] = [...conversationHistory];

    if (imageData) {
      let base64Data: string;
      let mediaType: string = "image/jpeg";

      if (imageData.includes("base64,")) {
        const parts = imageData.split(",");
        const header = parts[0];
        base64Data = parts[1];
        const mediaTypeMatch = header.match(/data:([^;]+)/);
        if (mediaTypeMatch) mediaType = mediaTypeMatch[1];
      } else {
        base64Data = imageData;
      }

      const uploadHint =
        retrievalPlan.intent === "similar"
          ? "User wants SIMILAR items to this garment."
          : "User wants pieces to COMBINE with this garment (complementary categories).";

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text:
              (userMessage ||
                "Please analyze this fashion item and provide styling advice.") +
              `\n\n(${uploadHint})`,
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

    const models = ["claude-haiku-4-5"];

    let response;
    let lastError;

    for (const model of models) {
      try {
        response = await anthropic.messages.create({
          model: model,
          system: buildSystemPrompt(retrievalPlan, wardrobeInventory),
          messages: messages,
          temperature: 0.4,
          max_tokens: 1200,
        });
        break;
      } catch (error: any) {
        lastError = error;
        if (error?.status === 404 && models.indexOf(model) < models.length - 1) {
          console.log(`Model ${model} not available, trying next model...`);
          continue;
        }
        throw error;
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to get response from any model");
    }

    let assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "I'm sorry, I couldn't generate a response.";

    const displayPlan = mergeMentorHintsForDisplay(
      retrievalPlan,
      mentorHintsFromAssistant(assistantMessage)
    );

    const wardrobeHits = selectWardrobeForChat(
      wardrobe,
      retrievalPlan,
      userMessage,
      2
    );
    if (
      shouldAttachCatalog(retrievalPlan, userMessage) ||
      hasImage ||
      wardrobeHits.length > 0
    ) {
      try {
        assistantMessage = await injectOutfits(
          assistantMessage,
          retrievalPlan,
          displayPlan,
          userMessage,
          wardrobe,
          4
        );
      } catch (error) {
        console.error("Error adding catalog items to response:", error);
      }
    }

    return {
      message: assistantMessage,
      responseType: "text",
    };
  } catch (error: any) {
    console.error("Error generating fashion response:", error);

    if (error?.status === 429 || error?.error?.type === "insufficient_quota") {
      console.log("Anthropic API quota exceeded, switching to local data mode");
      useLocalDataFallback = true;
    } else {
      console.log(
        "Anthropic API error, using local DeepFashion fallback for this request"
      );
    }

    const localResponse = await generateLocalFashionResponse(
      userMessage,
      hasImage,
      priorUserTexts
    );
    let formattedResponse = localResponse.message;
    const wardrobeOutfits = selectWardrobeForChat(
      wardrobe,
      retrievalPlan,
      userMessage,
      2
    );
    const outfits = [
      ...wardrobeOutfits,
      ...(localResponse.outfits || []),
    ].slice(0, 4);

    if (localResponse.colors || outfits.length || localResponse.accessories) {
      formattedResponse +=
        "\n\n```json\n" +
        JSON.stringify(
          {
            intent: retrievalPlan.intent,
            audience: retrievalPlan.audience,
            anchorGarment: retrievalPlan.anchorGarment,
            targetCategories: retrievalPlan.targetCategories,
            colors: [],
            styleTags: retrievalPlan.styleTags,
            outfits,
            accessories: localResponse.accessories || [],
            wardrobeReferenced: wardrobeOutfits.length > 0,
          },
          null,
          2
        ) +
        "\n```";
    }

    return {
      message: formattedResponse,
      responseType: "text",
    };
  }
}
