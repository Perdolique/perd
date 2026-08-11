CREATE TABLE "equipment_item_photo_submissions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"itemId" uuid NOT NULL,
	"cloudflareImageId" text NOT NULL UNIQUE,
	"filename" varchar(255) NOT NULL,
	"sourceType" varchar(16) NOT NULL,
	"sourceUrl" text,
	"rightsConfirmed" boolean NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_item_photo_submissions_source_check" CHECK (("sourceType" = 'own' AND "sourceUrl" IS NULL) OR ("sourceType" = 'manufacturer' AND NULLIF(BTRIM("sourceUrl"), '') IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "equipment_item_photo_submissions" ADD CONSTRAINT "equipment_item_photo_submissions_itemId_equipment_items_id_fkey" FOREIGN KEY ("itemId") REFERENCES "equipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "equipment_item_photo_submissions" ADD CONSTRAINT "equipment_item_photo_submissions_createdBy_users_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;