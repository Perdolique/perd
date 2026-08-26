ALTER TABLE "equipment_item_photo_submissions" ADD COLUMN "idempotencyKey" uuid;--> statement-breakpoint
UPDATE "equipment_item_photo_submissions" SET "idempotencyKey" = "id";--> statement-breakpoint
ALTER TABLE "equipment_item_photo_submissions" ALTER COLUMN "idempotencyKey" SET NOT NULL;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "equipment_item_photo_submissions"
		WHERE char_length("sourceUrl") > 2048
	) THEN
		RAISE EXCEPTION 'equipment_item_photo_submissions.sourceUrl exceeds 2048 characters';
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "equipment_item_photo_submissions" ALTER COLUMN "sourceUrl" SET DATA TYPE varchar(2048) USING "sourceUrl"::varchar(2048);--> statement-breakpoint
ALTER TABLE "equipment_item_photo_submissions" ADD CONSTRAINT "equipment_item_photo_submissions_createdBy_idempotencyKey_unique" UNIQUE("createdBy","idempotencyKey");--> statement-breakpoint
CREATE INDEX "equipment_item_photo_submissions_creator_history_index" ON "equipment_item_photo_submissions" ("createdBy","createdAt" DESC NULLS LAST,"id" DESC NULLS LAST);
