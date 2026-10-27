import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';
import 'dotenv/config';

// Check for required environment variable
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres client
const client = postgres(process.env.DATABASE_URL, { max: 3 });

// Create drizzle database instance
export const db = drizzle(client, { schema });

/**
 * M5 wardrobe table may be missing when `drizzle-kit push` reports
 * "No changes detected" against a DB that predated wardrobe_items.
 * Idempotent safety net so GET/POST /api/wardrobe do not 500 with 42P01.
 */
export async function ensureWardrobeItemsTable(): Promise<void> {
  await client`
    CREATE TABLE IF NOT EXISTS "wardrobe_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "session_id" text NOT NULL,
      "user_id" integer,
      "title" text NOT NULL,
      "image_key" text NOT NULL,
      "image_url" text NOT NULL,
      "category" text DEFAULT 'unknown' NOT NULL,
      "tag" text DEFAULT 'other' NOT NULL,
      "colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `;
  await client`
    DO $$ BEGIN
      ALTER TABLE "wardrobe_items"
        ADD CONSTRAINT "wardrobe_items_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE no action ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;
}

/** One-shot scripts must close the pool or the process never exits. */
export async function closeDb(): Promise<void> {
  await client.end({ timeout: 5 });
}