CREATE TABLE "password_reset_tokens" (
	"tokenHash" varchar(64) PRIMARY KEY,
	"email" varchar(254) NOT NULL,
	"redirectTo" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	CONSTRAINT "password_reset_tokens_normalized_email_check" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sessionVersion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "password_reset_tokens_email_index" ON "password_reset_tokens" ("email");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_index" ON "password_reset_tokens" ("expiresAt");--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_email_email_credentials_email_fkey" FOREIGN KEY ("email") REFERENCES "email_credentials"("email") ON DELETE CASCADE ON UPDATE CASCADE;