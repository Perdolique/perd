CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"providerId" integer NOT NULL,
	"accountId" varchar NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_accounts_providerId_accountId_unique" UNIQUE("providerId","accountId")
);
--> statement-breakpoint
CREATE TABLE "oauth_providers" (
	"id" serial PRIMARY KEY,
	"type" varchar(32) NOT NULL UNIQUE,
	"name" varchar(32) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" varchar(32),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"isAdmin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_providerId_oauth_providers_id_fkey" FOREIGN KEY ("providerId") REFERENCES "oauth_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;