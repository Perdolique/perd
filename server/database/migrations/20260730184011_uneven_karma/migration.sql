CREATE TABLE "equipment_item_images" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"itemId" uuid NOT NULL,
	"cloudflareImageId" text NOT NULL UNIQUE,
	"displayOrder" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_item_images_itemId_displayOrder_unique" UNIQUE("itemId","displayOrder"),
	CONSTRAINT "equipment_item_images_displayOrder_check" CHECK ("displayOrder" >= 0)
);
--> statement-breakpoint
ALTER TABLE "equipment_item_images" ADD CONSTRAINT "equipment_item_images_itemId_equipment_items_id_fkey" FOREIGN KEY ("itemId") REFERENCES "equipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
