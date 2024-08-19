CREATE EXTENSION IF NOT EXISTS ulid;

CREATE TABLE IF NOT EXISTS "checklistItems" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_monotonic_ulid() NOT NULL,
	"checklistId" "ulid" NOT NULL,
	"equipmentId" "ulid" NOT NULL,
	CONSTRAINT "checklistItems_checklistId_equipmentId_unique" UNIQUE("checklistId","equipmentId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklists" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_monotonic_ulid() NOT NULL,
	"userId" "ulid" NOT NULL,
	"name" varchar(32) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_monotonic_ulid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"weight" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "userEquipment" (
	"userId" "ulid" NOT NULL,
	"equipmentId" "ulid" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "userEquipment_userId_equipmentId_pk" PRIMARY KEY("userId","equipmentId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" "ulid" PRIMARY KEY DEFAULT gen_monotonic_ulid() NOT NULL,
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
CREATE INDEX IF NOT EXISTS "createdAtIndex" ON "checklists" USING btree ("createdAt");
