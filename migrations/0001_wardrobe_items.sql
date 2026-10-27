CREATE TABLE "wardrobe_items" (
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
);
--> statement-breakpoint
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
