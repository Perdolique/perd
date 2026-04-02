CREATE TABLE "brands" (
	"id" serial PRIMARY KEY,
	"name" varchar(128) NOT NULL UNIQUE,
	"slug" varchar(128) NOT NULL UNIQUE,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_properties" (
	"id" serial PRIMARY KEY,
	"categoryId" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"dataType" varchar(16) NOT NULL,
	"unit" varchar(16),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_properties_categoryId_slug_unique" UNIQUE("categoryId","slug")
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"targetId" uuid NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_categories" (
	"id" serial PRIMARY KEY,
	"name" varchar(64) NOT NULL,
	"slug" varchar(128) NOT NULL UNIQUE,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_groups" (
	"id" serial PRIMARY KEY,
	"name" varchar(64) NOT NULL,
	"slug" varchar(128) NOT NULL UNIQUE,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"categoryId" integer NOT NULL,
	"brandId" integer NOT NULL,
	"name" varchar(256) NOT NULL,
	"status" varchar(16) DEFAULT 'approved' NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_property_values" (
	"id" serial PRIMARY KEY,
	"itemId" uuid NOT NULL,
	"propertyId" integer NOT NULL,
	"valueText" varchar,
	"valueNumber" numeric,
	"valueBoolean" boolean,
	CONSTRAINT "item_property_values_itemId_propertyId_unique" UNIQUE("itemId","propertyId")
);
--> statement-breakpoint
CREATE TABLE "property_enum_options" (
	"id" serial PRIMARY KEY,
	"propertyId" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(128) NOT NULL,
	CONSTRAINT "property_enum_options_propertyId_slug_unique" UNIQUE("propertyId","slug")
);
--> statement-breakpoint
CREATE TABLE "user_equipment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"itemId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_equipment_userId_itemId_unique" UNIQUE("userId","itemId")
);
--> statement-breakpoint
ALTER TABLE "category_properties" ADD CONSTRAINT "category_properties_categoryId_equipment_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "equipment_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_categoryId_equipment_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "equipment_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_brandId_brands_id_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_createdBy_users_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "item_property_values" ADD CONSTRAINT "item_property_values_itemId_equipment_items_id_fkey" FOREIGN KEY ("itemId") REFERENCES "equipment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "item_property_values" ADD CONSTRAINT "item_property_values_propertyId_category_properties_id_fkey" FOREIGN KEY ("propertyId") REFERENCES "category_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "property_enum_options" ADD CONSTRAINT "property_enum_options_propertyId_category_properties_id_fkey" FOREIGN KEY ("propertyId") REFERENCES "category_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_itemId_equipment_items_id_fkey" FOREIGN KEY ("itemId") REFERENCES "equipment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;