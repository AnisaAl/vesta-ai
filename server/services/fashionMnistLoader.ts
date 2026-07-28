import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FashionOutfit } from '../../client/src/lib/types';

// Fashion-MNIST label to category mapping
const LABEL_TO_CATEGORY: Record<number, string> = {
  0: 'T-shirt/top',
  1: 'Trouser',
  2: 'Pullover',
  3: 'Dress',
  4: 'Coat',
  5: 'Sandal',
  6: 'Shirt',
  7: 'Sneaker',
  8: 'Bag',
  9: 'Ankle boot'
};

// Category descriptions
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'T-shirt/top': 'Classic t-shirt or top, perfect for casual wear',
  'Trouser': 'Comfortable trousers for everyday style',
  'Pullover': 'Warm pullover sweater for cooler days',
  'Dress': 'Elegant dress for various occasions',
  'Coat': 'Stylish coat for outerwear',
  'Sandal': 'Comfortable sandals for warm weather',
  'Shirt': 'Versatile shirt for multiple occasions',
  'Sneaker': 'Casual sneakers for active lifestyle',
  'Bag': 'Fashionable bag to complete your look',
  'Ankle boot': 'Stylish ankle boots for any season'
};

interface FashionMnistItem {
  label: number;
  pixels: number[];
  category: string;
  imageData: string; // Base64 data URL
}

// Cache for loaded data
let fashionMnistCache: FashionMnistItem[] | null = null;

/**
 * Convert 784 pixels (28x28) to a base64 image
 * Uses SVG as a simple, dependency-free approach
 */
function pixelsToBase64Image(pixels: number[]): string {
  const width = 28;
  const height = 28;
  
  // Normalize pixels to 0-255 range
  const normalizedPixels = pixels.map(p => Math.max(0, Math.min(255, Math.round(p))));
  
  // Create SVG representation (scales up for better visibility)
  const scale = 5; // Scale factor for better visibility
  const svgPixels = normalizedPixels.map((pixel, i) => {
    const x = (i % width) * scale;
    const y = Math.floor(i / width) * scale;
    const gray = pixel;
    return `<rect x="${x}" y="${y}" width="${scale}" height="${scale}" fill="rgb(${gray},${gray},${gray})"/>`;
  }).join('');
  
  const svg = `<svg width="${width * scale}" height="${height * scale}" xmlns="http://www.w3.org/2000/svg">${svgPixels}</svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}


/**
 * Load fashion-mnist data from CSV files
 */
export function loadFashionMnistData(): FashionMnistItem[] {
  if (fashionMnistCache) {
    return fashionMnistCache;
  }

  try {
    const dataPath = join(process.cwd(), 'server', 'data', 'fashion-mnist_train.csv');
    const fileContent = readFileSync(dataPath, 'utf-8');
    
    // Parse CSV (skip header, limit to reasonable number for performance)
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      to_line: 5000 // Increased limit to get more variety
    });

    const items: FashionMnistItem[] = [];

    for (const record of records) {
      const label = parseInt(record.label);
      const pixels: number[] = [];
      
      // Extract all pixel values (784 pixels total)
      // Pixel values are 0-255 (darkness of pixel)
      for (let i = 1; i <= 784; i++) {
        const pixelValue = parseInt(record[`pixel${i}`]) || 0;
        // Ensure pixel value is in valid range (0-255)
        pixels.push(Math.max(0, Math.min(255, pixelValue)));
      }
      
      // Verify we have exactly 784 pixels
      if (pixels.length !== 784) {
        console.warn(`Row ${items.length + 1} has ${pixels.length} pixels, expected 784`);
        continue; // Skip this row if pixel count is wrong
      }

      const category = LABEL_TO_CATEGORY[label] || 'Unknown';
      const imageData = pixelsToBase64Image(pixels);

      items.push({
        label,
        pixels,
        category,
        imageData
      });
    }

    fashionMnistCache = items;
    
    // Log statistics about loaded data
    const categoryCounts: Record<string, number> = {};
    items.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });
    
    console.log(`✓ Loaded ${items.length} fashion items from Fashion-MNIST dataset`);
    console.log(`✓ Categories: ${Object.entries(categoryCounts).map(([cat, count]) => `${cat}(${count})`).join(', ')}`);
    console.log(`✓ Sample item: Label=${items[0]?.label}, Category=${items[0]?.category}, Pixels=${items[0]?.pixels.length}, ImageData=${items[0]?.imageData.substring(0, 50)}...`);
    
    return items;
  } catch (error) {
    console.error('Error loading fashion-mnist data:', error);
    return [];
  }
}

/**
 * Get fashion items by category name
 */
export function getItemsByCategory(categoryName: string, limit: number = 4): FashionMnistItem[] {
  const allItems = loadFashionMnistData();
  const normalizedCategory = categoryName.toLowerCase();
  
  // Try to match category
  const matchedItems = allItems.filter(item => 
    item.category.toLowerCase().includes(normalizedCategory) ||
    normalizedCategory.includes(item.category.toLowerCase())
  );

  // If no direct match, try fuzzy matching
  if (matchedItems.length === 0) {
    // Map common search terms to categories
    const searchTermMap: Record<string, string[]> = {
      'shirt': ['T-shirt/top', 'Shirt', 'Pullover'],
      'top': ['T-shirt/top', 'Shirt'],
      'pants': ['Trouser'],
      'trousers': ['Trouser'],
      'jeans': ['Trouser'],
      'sweater': ['Pullover'],
      'dress': ['Dress'],
      'coat': ['Coat'],
      'jacket': ['Coat'],
      'shoes': ['Sneaker', 'Sandal', 'Ankle boot'],
      'sneakers': ['Sneaker'],
      'boots': ['Ankle boot'],
      'bag': ['Bag'],
      'handbag': ['Bag']
    };

    for (const [term, categories] of Object.entries(searchTermMap)) {
      if (normalizedCategory.includes(term)) {
        const items = allItems.filter(item => 
          categories.some(cat => item.category === cat)
        );
        if (items.length > 0) {
          return items.slice(0, limit);
        }
      }
    }
  }

  return matchedItems.slice(0, limit);
}

/**
 * Get fashion items by label (0-9)
 */
export function getItemsByLabel(label: number, limit: number = 4): FashionMnistItem[] {
  const allItems = loadFashionMnistData();
  return allItems.filter(item => item.label === label).slice(0, limit);
}

/**
 * Convert FashionMnistItem to FashionOutfit format
 */
export function itemToOutfit(item: FashionMnistItem, index: number): FashionOutfit {
  return {
    id: `fashion-mnist-${item.label}-${index}`,
    name: item.category,
    description: CATEGORY_DESCRIPTIONS[item.category] || `A stylish ${item.category.toLowerCase()}`,
    imageUrl: item.imageData
  };
}

/**
 * Get outfit recommendations from fashion-mnist data based on query
 */
export function getOutfitsFromMnist(query: string, limit: number = 4): FashionOutfit[] {
  const lowerQuery = query.toLowerCase();
  
  // Try to find matching category
  const items = getItemsByCategory(lowerQuery, limit);
  
  if (items.length === 0) {
    // If no match, return random items from different categories
    const allItems = loadFashionMnistData();
    const uniqueCategories = new Set<string>();
    const selectedItems: FashionMnistItem[] = [];
    
    for (const item of allItems) {
      if (!uniqueCategories.has(item.category) && selectedItems.length < limit) {
        uniqueCategories.add(item.category);
        selectedItems.push(item);
      }
    }
    
    return selectedItems.map((item, idx) => itemToOutfit(item, idx));
  }
  
  return items.map((item, idx) => itemToOutfit(item, idx));
}

/**
 * Get all fashion items from fashion-mnist (for Recommendations page)
 */
export function getAllFashionItems(limit: number = 12): FashionOutfit[] {
  const allItems = loadFashionMnistData();
  
  // Return diverse items from different categories
  const categoryMap = new Map<string, FashionMnistItem[]>();
  
  // Group items by category
  for (const item of allItems) {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, []);
    }
    categoryMap.get(item.category)!.push(item);
  }
  
  // Select items from each category
  const selectedItems: FashionMnistItem[] = [];
  const categories = Array.from(categoryMap.keys());
  
  // Distribute items across categories
  let categoryIndex = 0;
  while (selectedItems.length < limit && categories.length > 0) {
    const category = categories[categoryIndex % categories.length];
    const categoryItems = categoryMap.get(category)!;
    
    if (categoryItems.length > 0) {
      // Pick a random item from this category
      const randomIndex = Math.floor(Math.random() * categoryItems.length);
      selectedItems.push(categoryItems[randomIndex]);
      categoryItems.splice(randomIndex, 1); // Remove to avoid duplicates
      
      // Remove category if empty
      if (categoryItems.length === 0) {
        categories.splice(categories.indexOf(category), 1);
      }
    }
    
    categoryIndex++;
  }
  
  return selectedItems.map((item, idx) => itemToOutfit(item, idx));
}
