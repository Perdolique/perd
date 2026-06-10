CREATE TABLE "packing_list_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"packingListId" uuid NOT NULL,
	"customName" varchar(128),
	"userEquipmentId" uuid,
	"isPacked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packing_list_entries_packingListId_userEquipmentId_unique" UNIQUE("packingListId","userEquipmentId"),
	CONSTRAINT "packing_list_entries_source_check" CHECK ((("packing_list_entries"."customName" IS NOT NULL) <> ("packing_list_entries"."userEquipmentId" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "packing_list_entries" ADD CONSTRAINT "packing_list_entries_packingListId_packing_lists_id_fkey" FOREIGN KEY ("packingListId") REFERENCES "packing_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "packing_list_entries" ADD CONSTRAINT "packing_list_entries_userEquipmentId_user_equipment_id_fkey" FOREIGN KEY ("userEquipmentId") REFERENCES "user_equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;