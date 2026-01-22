DO $$ BEGIN
 CREATE TYPE "public"."equipmentAttributeDataType" AS ENUM('boolean', 'string', 'integer', 'decimal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklistItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"checklistId" "ulid" NOT NULL,
	"equipmentId" integer NOT NULL,
	CONSTRAINT "checklistItems_checklistId_equipmentId_unique" UNIQUE("checklistId","equipmentId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklists" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_ulid() NOT NULL,
	"userId" "ulid" NOT NULL,
	"name" varchar(32) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"weight" integer DEFAULT 0 NOT NULL,
	"equipmentTypeId" integer,
	"equipmentGroupId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipmentAttributeValues" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipmentId" integer NOT NULL,
	"equipmentAttributeId" integer NOT NULL,
	"value" varchar NOT NULL,
	CONSTRAINT "equipmentAttributeValues_equipmentId_equipmentAttributeId_unique" UNIQUE("equipmentId","equipmentAttributeId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipmentAttributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"dataType" "equipmentAttributeDataType" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipmentGroups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipmentTypeAttributes" (
	"equipmentTypeId" integer,
	"equipmentAttributeId" integer,
	CONSTRAINT "equipmentTypeAttributes_equipmentTypeId_equipmentAttributeId_pk" PRIMARY KEY("equipmentTypeId","equipmentAttributeId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipmentTypes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauthAccounts" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_ulid() NOT NULL,
	"userId" "ulid" NOT NULL,
	"providerId" integer NOT NULL,
	"accountId" varchar NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauthAccounts_providerId_accountId_unique" UNIQUE("providerId","accountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauthProviders" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(32) NOT NULL,
	"name" varchar(32) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauthProviders_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "userEquipment" (
	"userId" "ulid",
	"equipmentId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "userEquipment_userId_equipmentId_pk" PRIMARY KEY("userId","equipmentId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_ulid() NOT NULL,
	"name" varchar(32),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"isAdmin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklistItems" ADD CONSTRAINT "checklistItems_checklistId_checklists_id_fk" FOREIGN KEY ("checklistId") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklistItems" ADD CONSTRAINT "checklistItems_equipmentId_equipment_id_fk" FOREIGN KEY ("equipmentId") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklists" ADD CONSTRAINT "checklists_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment" ADD CONSTRAINT "equipment_equipmentTypeId_equipmentTypes_id_fk" FOREIGN KEY ("equipmentTypeId") REFERENCES "public"."equipmentTypes"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment" ADD CONSTRAINT "equipment_equipmentGroupId_equipmentGroups_id_fk" FOREIGN KEY ("equipmentGroupId") REFERENCES "public"."equipmentGroups"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipmentAttributeValues" ADD CONSTRAINT "equipmentAttributeValues_equipmentId_equipment_id_fk" FOREIGN KEY ("equipmentId") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipmentAttributeValues" ADD CONSTRAINT "equipmentAttributeValues_equipmentAttributeId_equipmentAttributes_id_fk" FOREIGN KEY ("equipmentAttributeId") REFERENCES "public"."equipmentAttributes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipmentTypeAttributes" ADD CONSTRAINT "equipmentTypeAttributes_equipmentTypeId_equipmentTypes_id_fk" FOREIGN KEY ("equipmentTypeId") REFERENCES "public"."equipmentTypes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipmentTypeAttributes" ADD CONSTRAINT "equipmentTypeAttributes_equipmentAttributeId_equipmentAttributes_id_fk" FOREIGN KEY ("equipmentAttributeId") REFERENCES "public"."equipmentAttributes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "userEquipment" ADD CONSTRAINT "userEquipment_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "userEquipment" ADD CONSTRAINT "userEquipment_equipmentId_equipment_id_fk" FOREIGN KEY ("equipmentId") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "createdAtIndex" ON "checklists" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_equipmentTypeId_index" ON "equipment" USING btree ("equipmentTypeId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_equipmentGroupId_index" ON "equipment" USING btree ("equipmentGroupId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipmentAttributeValues_equipmentId_index" ON "equipmentAttributeValues" USING btree ("equipmentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipmentAttributeValues_equipmentAttributeId_index" ON "equipmentAttributeValues" USING btree ("equipmentAttributeId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipmentTypeAttributes_equipmentTypeId_index" ON "equipmentTypeAttributes" USING btree ("equipmentTypeId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipmentTypeAttributes_equipmentAttributeId_index" ON "equipmentTypeAttributes" USING btree ("equipmentAttributeId");