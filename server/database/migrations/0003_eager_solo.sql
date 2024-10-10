ALTER TABLE "equipment" ADD COLUMN "userId" "ulid";--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "status" varchar(16) NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment" ADD CONSTRAINT "equipment_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
