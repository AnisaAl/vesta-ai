import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { messageSchema } from "@shared/schema";
import { generateFashionResponse } from "./services/fashionAi";
import { processVirtualTryOn, resolveVtoProvider, hostedVtoConfigured } from "./services/virtualTryOn";
import { getDeepFashionRecommendations, getDeepFashionOutfits } from "./services/deepFashion";
import { objectStorage } from "./services/objectStorage";
import { inferCategoryFromTitle } from "./services/wardrobe";
import { randomUUID } from "crypto";
import { appendFileSync } from "fs";

// #region agent log
function dbgLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown> = {}) {
  try {
    appendFileSync(
      "/opt/cursor/logs/debug.log",
      JSON.stringify({ hypothesisId, location, message, data, timestamp: Date.now() }) + "\n"
    );
  } catch {
    /* ignore debug log IO errors */
  }
}
// #endregion

const WARDROBE_TAGS = ["casual", "business", "colorful", "festive", "other"] as const;

function decodeDataUrl(imageData: string): { buffer: Buffer; contentType: string; ext: string } {
  let contentType = "image/jpeg";
  let base64 = imageData.trim();
  const comma = base64.indexOf(",");
  if (base64.startsWith("data:") && comma !== -1) {
    const header = base64.slice(0, comma);
    base64 = base64.slice(comma + 1);
    const match = header.match(/data:([^;]+)/);
    if (match) contentType = match[1];
  }
  const ext =
    contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";
  return { buffer: Buffer.from(base64.replace(/\s/g, ""), "base64"), contentType, ext };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check for Docker / load balancers
  app.get('/api/health', async (_req, res) => {
    return res.json({
      status: 'ok',
      storageMode: process.env.STORAGE_MODE || 'local',
      pythonServiceConfigured: Boolean(process.env.PYTHON_SERVICE_URL),
      vtoProvider: resolveVtoProvider(),
      vtoHostedConfigured: hostedVtoConfigured(),
    });
  });

  // Chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const requestSchema = z.object({
        message: z.string(),
        history: z.array(messageSchema).optional(),
        imageData: z.string().optional() // Base64 encoded image
      });

      const validatedData = requestSchema.parse(req.body);
      const wardrobe = await storage.listWardrobeItems(req.sessionId);

      // Process the message with Claude (with or without image)
      const response = await generateFashionResponse(
        validatedData.message,
        validatedData.history || [],
        validatedData.imageData,
        wardrobe
      );

      return res.json(response);
    } catch (error) {
      console.error('Error processing chat request:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      return res.status(500).json({ message: 'Error processing your request' });
    }
  });

  // Save chat history endpoint
  app.post('/api/chat/history', async (req, res) => {
    try {
      const requestSchema = z.object({
        messages: z.array(messageSchema),
        userId: z.number().optional()
      });

      const validatedData = requestSchema.parse(req.body);
      const localUser = await storage.ensureLocalUser();
      
      const chatHistory = await storage.createChatHistory({
        userId: localUser.id,
        messages: validatedData.messages
      });
      
      return res.json({ 
        success: true,
        chatHistoryId: chatHistory.id 
      });
    } catch (error) {
      console.error('Error saving chat history:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid chat history data', errors: error.errors });
      }
      return res.status(500).json({ message: 'Error saving chat history' });
    }
  });
  
  // Get chat history by ID
  app.get('/api/chat/history/:id', async (req, res) => {
    try {
      const historyId = parseInt(req.params.id);
      
      if (isNaN(historyId)) {
        return res.status(400).json({ message: 'Invalid chat history ID' });
      }
      
      const chatHistory = await storage.getChatHistory(historyId);
      
      if (!chatHistory) {
        return res.status(404).json({ message: 'Chat history not found' });
      }
      
      return res.json(chatHistory);
    } catch (error) {
      console.error('Error retrieving chat history:', error);
      return res.status(500).json({ message: 'Error retrieving chat history' });
    }
  });
  
  // Get all chat histories for a user (userId 1 = local MVP user)
  app.get('/api/chat/histories/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const localUser = await storage.ensureLocalUser();
      const resolvedId = userId === 1 ? localUser.id : userId;
      const chatHistories = await storage.getChatHistoriesByUserId(resolvedId);
      
      return res.json(chatHistories);
    } catch (error) {
      console.error('Error retrieving chat histories:', error);
      return res.status(500).json({ message: 'Error retrieving chat histories' });
    }
  });
  
  // Update chat history
  app.put('/api/chat/history/:id', async (req, res) => {
    try {
      const historyId = parseInt(req.params.id);
      
      if (isNaN(historyId)) {
        return res.status(400).json({ message: 'Invalid chat history ID' });
      }
      
      const requestSchema = z.object({
        messages: z.array(messageSchema)
      });
      
      const validatedData = requestSchema.parse(req.body);
      
      const updatedHistory = await storage.updateChatHistory(
        historyId, 
        validatedData.messages
      );
      
      if (!updatedHistory) {
        return res.status(404).json({ message: 'Chat history not found' });
      }
      
      return res.json({ 
        success: true,
        chatHistory: updatedHistory 
      });
    } catch (error) {
      console.error('Error updating chat history:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid chat history data', errors: error.errors });
      }
      return res.status(500).json({ message: 'Error updating chat history' });
    }
  });

  // Virtual try-on endpoint
  app.post('/api/virtual-try-on', async (req, res) => {
    try {
      const requestSchema = z.object({
        userPhoto: z.string(), // Base64 encoded image
        productImage: z.string(), // Base64 encoded image
        productName: z.string().optional(),
      });

      const validatedData = requestSchema.parse(req.body);
      
      // Process virtual try-on
      const result = await processVirtualTryOn({
        userPhoto: validatedData.userPhoto,
        productImage: validatedData.productImage,
        productName: validatedData.productName || 'Product',
      });
      
      return res.json(result);
    } catch (error) {
      console.error('Error processing virtual try-on:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error processing virtual try-on' 
      });
    }
  });

  // Get fashion recommendations from DeepFashion-MultiModal dataset
  app.get('/api/recommendations', async (req, res) => {
    try {
      const query = req.query.query as string | undefined;
      const limit = parseInt(req.query.limit as string) || 12;
      
      let outfits;
      if (query) {
        // Get items based on query
        outfits = getDeepFashionOutfits(query, limit);
      } else {
        // Get diverse items from all categories
        outfits = getDeepFashionRecommendations(limit);
      }
      
      return res.json({
        success: true,
        outfits: outfits,
        count: outfits.length
      });
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error getting recommendations' 
      });
    }
  });

  /**
   * Persisted wardrobe (session-scoped like cart). Uploads go through objectStorage.
   * Items are never shoppable — chat may reference them; catalog remains affiliate-only.
   */
  app.get('/api/wardrobe', async (req, res) => {
    // #region agent log
    dbgLog("A", "routes.ts:GET /api/wardrobe", "list entry", {
      sessionIdPresent: Boolean(req.sessionId),
      sessionIdLen: req.sessionId?.length ?? 0,
    });
    // #endregion
    try {
      const items = await storage.listWardrobeItems(req.sessionId);
      // #region agent log
      dbgLog("A", "routes.ts:GET /api/wardrobe", "list success", { count: items.length });
      // #endregion
      return res.json({ success: true, items });
    } catch (error) {
      // #region agent log
      dbgLog("A", "routes.ts:GET /api/wardrobe", "list failed", {
        errName: error instanceof Error ? error.name : typeof error,
        errMessage: error instanceof Error ? error.message : String(error),
        errCode: (error as { code?: string })?.code,
      });
      // #endregion
      console.error('Error listing wardrobe:', error);
      return res.status(500).json({ message: 'Error listing wardrobe' });
    }
  });

  app.post('/api/wardrobe', async (req, res) => {
    // #region agent log
    dbgLog("C", "routes.ts:POST /api/wardrobe", "upload entry", {
      sessionIdPresent: Boolean(req.sessionId),
      hasImageData: typeof req.body?.imageData === "string",
      imageDataLen: typeof req.body?.imageData === "string" ? req.body.imageData.length : 0,
      storageMode: process.env.STORAGE_MODE || "local",
    });
    // #endregion
    try {
      const body = z
        .object({
          imageData: z.string().min(32),
          title: z.string().trim().min(1).max(120).optional(),
          tag: z.enum(WARDROBE_TAGS).optional(),
          category: z.string().trim().max(40).optional(),
          colors: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
        })
        .parse(req.body);

      const { buffer, contentType, ext } = decodeDataUrl(body.imageData);
      if (buffer.length < 32) {
        return res.status(400).json({ message: 'Image data is empty or invalid' });
      }
      if (buffer.length > 12 * 1024 * 1024) {
        return res.status(400).json({ message: 'Image too large (max 12MB)' });
      }

      // #region agent log
      dbgLog("C", "routes.ts:POST /api/wardrobe", "before objectStorage", {
        bufferLen: buffer.length,
        contentType,
        ext,
      });
      // #endregion
      await objectStorage.ensureReady();
      const key = `wardrobe/${req.sessionId}/${randomUUID()}.${ext}`;
      const stored = await objectStorage.putObject(key, buffer, contentType);
      // #region agent log
      dbgLog("C", "routes.ts:POST /api/wardrobe", "objectStorage ok", {
        key: stored.key,
        url: stored.url,
      });
      // #endregion

      const title = body.title || `Wardrobe item`;
      const category =
        body.category && body.category !== "unknown"
          ? body.category
          : inferCategoryFromTitle(title);

      // #region agent log
      dbgLog("D", "routes.ts:POST /api/wardrobe", "before ensureLocalUser", {});
      // #endregion
      const localUser = await storage.ensureLocalUser();
      // #region agent log
      dbgLog("D", "routes.ts:POST /api/wardrobe", "ensureLocalUser ok", { userId: localUser.id });
      // #endregion
      const item = await storage.createWardrobeItem({
        sessionId: req.sessionId,
        userId: localUser.id,
        title,
        imageKey: stored.key,
        imageUrl: stored.url,
        category,
        tag: body.tag || "other",
        colors: body.colors || [],
      });
      // #region agent log
      dbgLog("A", "routes.ts:POST /api/wardrobe", "createWardrobeItem ok", { itemId: item?.id });
      // #endregion

      return res.status(201).json({ success: true, item });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid wardrobe upload', errors: error.errors });
      }
      // #region agent log
      dbgLog("A", "routes.ts:POST /api/wardrobe", "upload failed", {
        errName: error instanceof Error ? error.name : typeof error,
        errMessage: error instanceof Error ? error.message : String(error),
        errCode: (error as { code?: string })?.code,
      });
      // #endregion
      console.error('Error uploading wardrobe item:', error);
      return res.status(500).json({ message: 'Error uploading wardrobe item' });
    }
  });

  app.patch('/api/wardrobe/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid wardrobe item id' });
      }

      const body = z
        .object({
          title: z.string().trim().min(1).max(120).optional(),
          tag: z.enum(WARDROBE_TAGS).optional(),
          category: z.string().trim().max(40).optional(),
          colors: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
        })
        .parse(req.body);

      const updated = await storage.updateWardrobeItem(req.sessionId, id, body);
      if (!updated) {
        return res.status(404).json({ message: 'Wardrobe item not found' });
      }
      return res.json({ success: true, item: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid wardrobe update', errors: error.errors });
      }
      console.error('Error updating wardrobe item:', error);
      return res.status(500).json({ message: 'Error updating wardrobe item' });
    }
  });

  app.delete('/api/wardrobe/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid wardrobe item id' });
      }

      const removed = await storage.deleteWardrobeItem(req.sessionId, id);
      if (!removed) {
        return res.status(404).json({ message: 'Wardrobe item not found' });
      }
      return res.json({ success: true, item: removed });
    } catch (error) {
      console.error('Error deleting wardrobe item:', error);
      return res.status(500).json({ message: 'Error deleting wardrobe item' });
    }
  });

  /**
   * Affiliate product catalog (online-only). Filters: audience, category, color, style, search.
   * Cart / checkout handoff is Milestone 3 — this returns shoppable affiliateUrl only.
   */
  app.get('/api/catalog', async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '24'), 10) || 24, 100);
      const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
      const audience = typeof req.query.audience === 'string' ? req.query.audience : undefined;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const color = typeof req.query.color === 'string' ? req.query.color : undefined;
      const style = typeof req.query.style === 'string' ? req.query.style : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      // alias gender → audience
      const gender = typeof req.query.gender === 'string' ? req.query.gender : undefined;
      const resolvedAudience = audience || gender;

      const query = {
        audience: resolvedAudience,
        category,
        color,
        style,
        search,
        limit,
        offset,
        activeOnly: true,
      };

      const [items, total] = await Promise.all([
        storage.listProducts(query),
        storage.countProducts(query),
      ]);

      return res.json({
        success: true,
        total,
        limit,
        offset,
        products: items.map((p) => ({
          id: p.id,
          externalId: p.externalId,
          merchant: p.merchant,
          title: p.title,
          description: p.description,
          imageUrl: p.imageUrl,
          affiliateUrl: p.affiliateUrl,
          priceCents: p.priceCents,
          currency: p.currency,
          category: p.category,
          audience: p.audience,
          colors: p.colors,
          styleTags: p.styleTags,
        })),
      });
    } catch (error) {
      console.error('Error listing catalog:', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Error listing catalog',
      });
    }
  });

  /**
   * Cart — staging only. Vesta never takes payment; checkout is handed off to
   * the merchant via the affiliate link (see GET /api/go/:productId).
   * Ownership always comes from the session cookie, never from the request body.
   */
  async function cartPayload(sessionId: string) {
    const cart = await storage.getOrCreateCart(sessionId);
    const lines = await storage.getCartLines(cart.id);

    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const priced = lines.filter((line) => typeof line.product.priceCents === 'number');
    const subtotalCents = priced.reduce(
      (sum, line) => sum + (line.product.priceCents as number) * line.quantity,
      0
    );
    const currency = priced[0]?.product.currency || 'USD';

    // Affiliate carts span merchants, so checkout is per merchant
    const merchants = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = line.product.merchant;
      if (!merchants.has(key)) merchants.set(key, []);
      merchants.get(key)!.push(line);
    }

    return {
      itemCount,
      subtotalCents,
      currency,
      hasUnpricedItems: priced.length !== lines.length,
      merchants: Array.from(merchants.entries()).map(([merchant, items]) => ({
        merchant,
        items: items.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          productId: line.product.id,
          title: line.product.title,
          imageUrl: line.product.imageUrl,
          priceCents: line.product.priceCents,
          currency: line.product.currency,
          isActive: line.product.isActive,
          checkoutUrl: `/api/go/${line.product.id}?source=cart`,
        })),
      })),
    };
  }

  app.get('/api/cart', async (req, res) => {
    try {
      return res.json({ success: true, cart: await cartPayload(req.sessionId) });
    } catch (error) {
      console.error('Error loading cart:', error);
      return res.status(500).json({ message: 'Error loading cart' });
    }
  });

  app.post('/api/cart/items', async (req, res) => {
    try {
      const body = z
        .object({
          productId: z.number().int().positive(),
          quantity: z.number().int().min(1).max(20).optional(),
        })
        .parse(req.body);

      const product = await storage.getProductById(body.productId);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: 'Product not available' });
      }

      const cart = await storage.getOrCreateCart(req.sessionId);
      await storage.addCartItem(cart.id, product.id, body.quantity ?? 1);

      return res.json({ success: true, cart: await cartPayload(req.sessionId) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid cart item', errors: error.errors });
      }
      console.error('Error adding cart item:', error);
      return res.status(500).json({ message: 'Error adding cart item' });
    }
  });

  app.patch('/api/cart/items/:itemId', async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId, 10);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: 'Invalid item id' });
      }

      const body = z.object({ quantity: z.number().int().min(0).max(20) }).parse(req.body);
      const cart = await storage.getOrCreateCart(req.sessionId);

      const changed =
        body.quantity === 0
          ? await storage.removeCartItem(cart.id, itemId)
          : await storage.setCartItemQuantity(cart.id, itemId, body.quantity);

      if (!changed) {
        return res.status(404).json({ message: 'Cart item not found' });
      }

      return res.json({ success: true, cart: await cartPayload(req.sessionId) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid quantity', errors: error.errors });
      }
      console.error('Error updating cart item:', error);
      return res.status(500).json({ message: 'Error updating cart item' });
    }
  });

  app.delete('/api/cart/items/:itemId', async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId, 10);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: 'Invalid item id' });
      }

      const cart = await storage.getOrCreateCart(req.sessionId);
      const removed = await storage.removeCartItem(cart.id, itemId);
      if (!removed) {
        return res.status(404).json({ message: 'Cart item not found' });
      }

      return res.json({ success: true, cart: await cartPayload(req.sessionId) });
    } catch (error) {
      console.error('Error removing cart item:', error);
      return res.status(500).json({ message: 'Error removing cart item' });
    }
  });

  app.delete('/api/cart', async (req, res) => {
    try {
      const cart = await storage.getOrCreateCart(req.sessionId);
      await storage.clearCart(cart.id);
      return res.json({ success: true, cart: await cartPayload(req.sessionId) });
    } catch (error) {
      console.error('Error clearing cart:', error);
      return res.status(500).json({ message: 'Error clearing cart' });
    }
  });

  /**
   * Outbound affiliate handoff. Records the click first-party (needed to
   * reconcile network reports) then redirects to the merchant.
   */
  app.get('/api/go/:productId', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId, 10);
      if (isNaN(productId)) {
        return res.status(400).json({ message: 'Invalid product id' });
      }

      const product = await storage.getProductById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const source = typeof req.query.source === 'string' ? req.query.source : 'unknown';
      try {
        await storage.logProductClick(product.id, req.sessionId, source);
      } catch (logError) {
        // Never block the handoff on analytics
        console.error('Error logging product click:', logError);
      }

      return res.redirect(302, product.affiliateUrl);
    } catch (error) {
      console.error('Error handling affiliate redirect:', error);
      return res.status(500).json({ message: 'Error handling affiliate redirect' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
