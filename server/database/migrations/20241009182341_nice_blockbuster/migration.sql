ALTER TABLE "equipment" RENAME COLUMN "userId" TO "creatorId";--> statement-breakpoint
ALTER TABLE "equipment" DROP CONSTRAINT "equipment_userId_users_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment" ADD CONSTRAINT "equipment_creatorId_users_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
