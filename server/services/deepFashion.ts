import { readFileSync, readdirSync } from "fs";
import path from "path";
import { FashionOutfit } from "../../client/src/lib/types";

interface DeepFashionItem {
  id: string;
  fileName: string;
  caption: string;
  imageUrl: string;
}

let deepFashionCache: DeepFashionItem[] | null = null;

const DEEPFASHION_ROOT = path.join(
  process.cwd(),
  "server",
  "data",
  "DeepFashion-MultiModal"
);
const IMAGES_DIR = path.join(DEEPFASHION_ROOT, "images");
const CAPTIONS_PATH = path.join(DEEPFASHION_ROOT, "captions.json");

function loadDeepFashionData(): DeepFashionItem[] {
  if (deepFashionCache) return deepFashionCache;

  try {
    const captionsRaw = readFileSync(CAPTIONS_PATH, "utf-8");
    const captions: Record<string, string> = JSON.parse(captionsRaw);

    // Get list of image files to ensure we only use existing images
    const imageFiles = new Set<string>(readdirSync(IMAGES_DIR));

    const items: DeepFashionItem[] = [];

    for (const [fileName, caption] of Object.entries(captions)) {
      if (!imageFiles.has(fileName)) continue;

      // Prefer full body or front-view images
      const lower = fileName.toLowerCase();
      if (
        !lower.includes("_full") &&
        !lower.includes("_front") &&
        !lower.includes("_1_front")
      ) {
        continue;
      }

      const imageUrl = `/data/deepfashion/images/${encodeURIComponent(
        fileName
      )}`;

      const id = `deepfashion-${fileName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

      items.push({
        id,
        fileName,
        caption,
        imageUrl,
      });
    }

    deepFashionCache = items;

    console.log(
      `✓ Loaded ${items.length} DeepFashion-MultiModal items from ${IMAGES_DIR}`
    );

    return items;
  } catch (error) {
    console.error("Error loading DeepFashion-MultiModal data:", error);
    deepFashionCache = [];
    return [];
  }
}

/**
 * Map a DeepFashionItem to the shared FashionOutfit shape
 */
function itemToOutfit(item: DeepFashionItem): FashionOutfit {
  // Try to derive a short name from the caption or filename
  let name = "Outfit";
  const lowerCaption = item.caption.toLowerCase();

  if (lowerCaption.includes("dress")) name = "Dress look";
  else if (lowerCaption.includes("jacket") || lowerCaption.includes("coat"))
    name = "Outerwear look";
  else if (lowerCaption.includes("skirt")) name = "Skirt look";
  else if (lowerCaption.includes("pants") || lowerCaption.includes("trousers"))
    name = "Pants look";
  else if (lowerCaption.includes("t-shirt") || lowerCaption.includes("shirt"))
    name = "Top look";

  return {
    id: item.id,
    name,
    description: item.caption,
    imageUrl: item.imageUrl,
  };
}

/**
 * Get DeepFashion outfits based on a free-text query (used inside chat)
 */
export function getDeepFashionOutfits(
  query: string,
  limit: number = 4
): FashionOutfit[] {
  const allItems = loadDeepFashionData();
  if (allItems.length === 0) return [];

  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter(Boolean);

  // Score items by how many query terms appear in caption or filename
  const scored = allItems
    .map((item) => {
      const haystack =
        item.caption.toLowerCase() + " " + item.fileName.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score++;
      }
      return { item, score };
    })
    .filter((s) => s.score > 0);

  let selected: DeepFashionItem[];

  if (scored.length === 0) {
    // If nothing matches, just pick diverse random items
    selected = getRandomDeepFashionItems(limit);
  } else {
    scored.sort((a, b) => b.score - a.score);
    selected = scored.slice(0, limit).map((s) => s.item);
  }

  return selected.map(itemToOutfit);
}

/**
 * Get a diverse set of outfits (used for generic recommendations)
 */
export function getDeepFashionRecommendations(
  limit: number = 12
): FashionOutfit[] {
  const items = getRandomDeepFashionItems(limit);
  return items.map(itemToOutfit);
}

function getRandomDeepFashionItems(limit: number): DeepFashionItem[] {
  const allItems = loadDeepFashionData();
  if (allItems.length === 0) return [];

  const shuffled = [...allItems].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

