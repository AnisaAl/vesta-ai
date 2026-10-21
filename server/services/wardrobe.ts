/**
 * Wardrobe helpers for chat grounding.
 * Closet items are never shoppable — no productId / affiliateUrl.
 */

import type { WardrobeItem } from "@shared/schema";
import type { FashionOutfit } from "../../client/src/lib/types";
import {
  FashionQueryPlan,
  GarmentCategory,
  detectAnchorCategory,
} from "./fashionIntent";

const WARDROBE_CUES =
  /\b(my wardrobe|my closet|what i (?:own|have)|from my wardrobe|in my wardrobe|pieces? i (?:own|have)|wardrobe item)\b/i;

export function mentionsWardrobe(text: string): boolean {
  return WARDROBE_CUES.test(text);
}

export function wardrobeItemToOutfit(item: WardrobeItem): FashionOutfit {
  return {
    id: `wardrobe-${item.id}`,
    name: item.title,
    description: `From your wardrobe · ${item.tag}`,
    imageUrl: item.imageUrl,
    source: "wardrobe",
    wardrobeItemId: item.id,
  };
}

function scoreWardrobeItem(item: WardrobeItem, plan: FashionQueryPlan, query: string): number {
  let score = 0;
  const category = (item.category || "unknown") as GarmentCategory;
  const title = item.title.toLowerCase();
  const tag = (item.tag || "").toLowerCase();
  const colors = (item.colors || []).map((c) => c.toLowerCase());
  const q = query.toLowerCase();

  if (title && q.includes(title)) score += 12;
  for (const word of title.split(/\s+/).filter((w) => w.length > 3)) {
    if (q.includes(word)) score += 3;
  }

  if (plan.intent === "combine") {
    if (plan.targetCategories.includes(category)) score += 6;
    else if (category === plan.anchorGarment) score += 4;
    else if (category !== "unknown") score += 1;
  } else if (plan.intent === "similar") {
    const want = plan.targetCategories[0] || plan.anchorGarment;
    if (want !== "unknown" && category === want) score += 8;
    else if (category === "unknown") score += 2;
  } else if (plan.intent === "browse") {
    const want = plan.targetCategories[0] || plan.anchorGarment;
    if (want !== "unknown" && category === want) score += 8;
  } else {
    score += 1;
  }

  for (const c of plan.colors) {
    if (colors.includes(c) || title.includes(c)) score += 3;
  }
  for (const s of plan.styleTags) {
    if (tag === s || title.includes(s)) score += 2;
  }

  return score;
}

/**
 * Pick closet pieces relevant to the locked retrieval plan / user wording.
 * Returns [] when nothing matches — chat still gets catalog via injectOutfits.
 */
export function selectWardrobeForChat(
  items: WardrobeItem[],
  plan: FashionQueryPlan,
  userMessage: string,
  limit = 2
): FashionOutfit[] {
  if (items.length === 0) return [];

  const wantWardrobe =
    mentionsWardrobe(userMessage) ||
    items.some((item) => userMessage.toLowerCase().includes(item.title.toLowerCase()));

  const scored = items
    .map((item) => ({ item, score: scoreWardrobeItem(item, plan, userMessage) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (wantWardrobe) {
    // Prefer matches; if the user asked about the closet but scores are flat, show recent items
    const picks = scored.length > 0 ? scored : items.map((item) => ({ item, score: 1 }));
    return picks.slice(0, limit).map((row) => wardrobeItemToOutfit(row.item));
  }

  // Soft include: strong title/category hits without explicit "my wardrobe"
  return scored
    .filter((row) => row.score >= 6)
    .slice(0, limit)
    .map((row) => wardrobeItemToOutfit(row.item));
}

export function formatWardrobeInventory(items: WardrobeItem[]): string {
  if (items.length === 0) {
    return "Wardrobe: empty (user has not uploaded closet items yet).";
  }
  const lines = items.map(
    (item, i) =>
      `${i + 1}. id=${item.id} "${item.title}" category=${item.category} tag=${item.tag}`
  );
  return `Wardrobe (user-owned, NOT for sale — never invent affiliate links for these):\n${lines.join("\n")}`;
}

/** Infer a garment category from a free-text title when the client omits one. */
export function inferCategoryFromTitle(title: string): GarmentCategory {
  return detectAnchorCategory(title);
}
