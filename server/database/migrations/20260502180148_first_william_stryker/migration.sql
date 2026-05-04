CREATE TABLE "packing_lists" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "packing_lists" ADD CONSTRAINT "packing_lists_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;