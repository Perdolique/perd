CREATE TABLE "email_credentials" (
	"userId" uuid PRIMARY KEY,
	"email" varchar(254) NOT NULL UNIQUE,
	"passwordHash" text NOT NULL,
	"verifiedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_credentials_normalized_email_check" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
CREATE TABLE "pending_email_registrations" (
	"tokenHash" varchar(64) PRIMARY KEY,
	"email" varchar(254) NOT NULL,
	"passwordHash" text NOT NULL,
	"redirectTo" text NOT NULL,
	"userId" uuid,
	"sessionIdHash" varchar(64),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	CONSTRAINT "pending_email_registrations_session_check" CHECK (("userId" IS NULL) = ("sessionIdHash" IS NULL)),
	CONSTRAINT "pending_email_registrations_normalized_email_check" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
CREATE INDEX "pending_email_registrations_email_index" ON "pending_email_registrations" ("email");--> statement-breakpoint
ALTER TABLE "email_credentials" ADD CONSTRAINT "email_credentials_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pending_email_registrations" ADD CONSTRAINT "pending_email_registrations_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;