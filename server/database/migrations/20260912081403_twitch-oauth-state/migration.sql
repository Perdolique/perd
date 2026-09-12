CREATE TABLE "twitch_oauth_states" (
	"stateHash" varchar(64) PRIMARY KEY,
	"sessionIdHash" varchar(64) NOT NULL UNIQUE,
	"intent" varchar(7) NOT NULL,
	"userId" uuid,
	"redirectTo" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	CONSTRAINT "twitch_oauth_states_actor_check" CHECK (("intent" = 'sign-in' AND "userId" IS NULL) OR ("intent" = 'link' AND "userId" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX "twitch_oauth_states_expires_at_index" ON "twitch_oauth_states" ("expiresAt");--> statement-breakpoint
ALTER TABLE "twitch_oauth_states" ADD CONSTRAINT "twitch_oauth_states_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;