CREATE TABLE IF NOT EXISTS "oauthAccounts" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_ulid() NOT NULL,
	"userId" "ulid" NOT NULL,
	"providerId" "ulid" NOT NULL,
	"accountId" varchar NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauthAccounts_providerId_accountId_unique" UNIQUE("providerId","accountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauthProviders" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_ulid() NOT NULL,
	"type" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauthProviders_type_unique" UNIQUE("type")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauthAccounts" ADD CONSTRAINT "oauthAccounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauthAccounts" ADD CONSTRAINT "oauthAccounts_providerId_oauthProviders_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."oauthProviders"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
