import { users, chatHistories, type User, type InsertUser, type ChatHistory, type InsertChatHistory, type Message } from "@shared/schema";
import { db } from "./db";
import { eq, or, isNull } from "drizzle-orm";

// Storage interface for user and chat history operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  ensureLocalUser(id?: number): Promise<User>;

  // Chat history operations
  getChatHistory(id: number): Promise<ChatHistory | undefined>;
  getChatHistoriesByUserId(userId: number): Promise<ChatHistory[]>;
  createChatHistory(chatHistory: InsertChatHistory): Promise<ChatHistory>;
  updateChatHistory(id: number, messages: Message[]): Promise<ChatHistory | undefined>;
}

// Database implementation of the storage interface
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  /** Ensures local MVP user exists so chat history FK saves succeed. */
  async ensureLocalUser(_id: number = 1): Promise<User> {
    const byName = await this.getUserByUsername("local");
    if (byName) return byName;

    return this.createUser({
      username: "local",
      password: "local-mvp-not-for-production",
    });
  }

  async getChatHistory(id: number): Promise<ChatHistory | undefined> {
    const [history] = await db.select().from(chatHistories).where(eq(chatHistories.id, id));
    return history || undefined;
  }

  async getChatHistoriesByUserId(userId: number): Promise<ChatHistory[]> {
    // Always include legacy rows saved without userId during early MVP
    return await db
      .select()
      .from(chatHistories)
      .where(or(eq(chatHistories.userId, userId), isNull(chatHistories.userId)));
  }

  async createChatHistory(chatHistory: InsertChatHistory): Promise<ChatHistory> {
    const [history] = await db
      .insert(chatHistories)
      .values(chatHistory)
      .returning();
    return history;
  }

  async updateChatHistory(id: number, messages: Message[]): Promise<ChatHistory | undefined> {
    const [updatedHistory] = await db
      .update(chatHistories)
      .set({
        messages: messages,
        updatedAt: new Date()
      })
      .where(eq(chatHistories.id, id))
      .returning();

    return updatedHistory || undefined;
  }
}

export const storage = new DatabaseStorage();
