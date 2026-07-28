import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model from original schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// New model for chat history
export const chatHistories = pgTable("chat_histories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChatHistorySchema = createInsertSchema(chatHistories).pick({
  userId: true,
  messages: true,
});

// Fashion MNIST data table
export const fashionMnistData = pgTable("fashion_mnist_data", {
  id: serial("id").primaryKey(),
  label: integer("label").notNull(),
  pixels: jsonb("pixels").notNull(), // Store all 784 pixels as a JSON array
  isTraining: boolean("is_training").notNull(), // To distinguish between train and test data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFashionMnistSchema = createInsertSchema(fashionMnistData).pick({
  label: true,
  pixels: true,
  isTraining: true,
});

// Define types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertChatHistory = z.infer<typeof insertChatHistorySchema>;
export type ChatHistory = typeof chatHistories.$inferSelect;

export type InsertFashionMnist = z.infer<typeof insertFashionMnistSchema>;
export type FashionMnistData = typeof fashionMnistData.$inferSelect;

// Message schema for validation
export const messageSchema = z.object({
  id: z.string(),
  content: z.string(),
  role: z.enum(['user', 'assistant']),
  timestamp: z.string(),
  imageData: z.string().optional(), // Base64 encoded image data
});

export type Message = z.infer<typeof messageSchema>;
