import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { messageSchema } from "@shared/schema";
import { generateFashionResponse } from "./services/fashionAi";
import { processVirtualTryOn } from "./services/virtualTryOn";
import { getDeepFashionRecommendations, getDeepFashionOutfits } from "./services/deepFashion";

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const requestSchema = z.object({
        message: z.string(),
        history: z.array(messageSchema).optional(),
        imageData: z.string().optional() // Base64 encoded image
      });

      const validatedData = requestSchema.parse(req.body);
      
      // Process the message with Claude (with or without image)
      const response = await generateFashionResponse(
        validatedData.message, 
        validatedData.history || [],
        validatedData.imageData
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

  const httpServer = createServer(app);
  return httpServer;
}
