ALTER TABLE "users" ADD COLUMN "guestSessionId" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_guestSessionId_key" UNIQUE("guestSessionId");