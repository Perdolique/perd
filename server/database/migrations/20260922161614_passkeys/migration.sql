CREATE TABLE "passkey_challenges" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"challengeHash" varchar(64) NOT NULL,
	"sessionIdHash" varchar(64) NOT NULL,
	"operation" text NOT NULL,
	"userId" uuid,
	"sessionVersion" integer,
	"name" varchar(64),
	"rpId" text NOT NULL,
	"origin" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	CONSTRAINT "passkey_challenges_sessionIdHash_operation_unique" UNIQUE("sessionIdHash","operation"),
	CONSTRAINT "passkey_challenges_actor_check" CHECK (
    ("operation" = 'registration' AND "userId" IS NOT NULL
      AND "sessionVersion" IS NOT NULL AND "name" IS NOT NULL)
    OR ("operation" = 'authentication' AND "userId" IS NULL
      AND "sessionVersion" IS NULL AND "name" IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "passkey_credentials" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"credentialId" text NOT NULL UNIQUE,
	"userId" uuid NOT NULL,
	"publicKey" text NOT NULL,
	"counter" bigint NOT NULL,
	"transports" text[] NOT NULL,
	"backupEligible" boolean NOT NULL,
	"backedUp" boolean NOT NULL,
	"name" varchar(64) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp with time zone,
	CONSTRAINT "passkey_credentials_counter_check" CHECK ("counter" BETWEEN 0 AND 4294967295),
	CONSTRAINT "passkey_credentials_backup_check" CHECK (NOT "backedUp" OR "backupEligible")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passkeyUserHandle" varchar(43);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_passkeyUserHandle_key" UNIQUE("passkeyUserHandle");--> statement-breakpoint
CREATE INDEX "passkey_challenges_expiry_index" ON "passkey_challenges" ("expiresAt");--> statement-breakpoint
CREATE INDEX "passkey_credentials_user_index" ON "passkey_credentials" ("userId");--> statement-breakpoint
ALTER TABLE "passkey_challenges" ADD CONSTRAINT "passkey_challenges_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "passkey_credentials" ADD CONSTRAINT "passkey_credentials_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;