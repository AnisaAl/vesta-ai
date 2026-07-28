CREATE TABLE "chat_histories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fashion_mnist_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" integer NOT NULL,
	"pixels" jsonb NOT NULL,
	"is_training" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "chat_histories" ADD CONSTRAINT "chat_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;