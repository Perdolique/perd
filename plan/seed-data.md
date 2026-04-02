# Seed data

**Purpose**: Without data in the database, you can't test or demo anything. This script populates the DB with realistic reference data (groups, categories, property definitions, brands) and a few sample items so the browsing and admin APIs have something to work with. It also serves as living documentation of what the data model looks like in practice. Uses the same DB connection pattern as `tools/migrate.ts`: WebSocket client from `server/utils/database.ts` + env config from `server/utils/config-env.ts`. The script should be idempotent — safe to run multiple times (use upserts or check-before-insert).

## File to create

`tools/seed.ts` — standalone CLI script, no Nitro runtime.

## Data definitions

### Groups

**Purpose**: Cover the main functional areas of outdoor gear. These are the top-level navigation entry points.

Shelter, Sleep, Packing, Cooking, Water, Clothing, Footwear, Navigation, Lighting, Electronics, Trekking, Safety.

### Categories (examples)

**Purpose**: Specific equipment types within each functional area. Each category has its own set of properties (EAV schema layer).

- Sleeping Bags, Sleeping Pads, Pillows
- Tents, Tarps, Bivvies
- Backpacks, Stuff Sacks
- Stoves, Cookware, Utensils
- Water Filters, Water Bottles

### Properties (examples)

**Purpose**: Define what measurable/filterable attributes each category has. These power the dynamic filter UI and item comparison. Each property has a `dataType` (number/text/boolean/enum) and optional `unit`.

Sleeping Bags:

- Temperature Rating (number, °C)
- Weight (number, g)
- Fill Type (enum: down/synthetic)
- Shape (enum: mummy/rectangular/quilt)

Sleeping Pads:

- R-Value (number)
- Weight (number, g)
- Type (enum: inflatable/foam/self-inflating)
- Thickness (number, cm)

### Brands (examples)

**Purpose**: Real outdoor gear manufacturers. Users will recognize these names, making the seed data feel realistic for testing.

Therm-a-Rest, Nemo, Sea to Summit, MSR, Big Agnes, Zpacks, Gossamer Gear, Enlightened Equipment.

### Items (a few examples)

**Purpose**: A handful of real items with property values filled in, to test the full EAV chain (item → property values → property definitions).

- Therm-a-Rest NeoAir XLite NXT Regular (Sleeping Pads)
- Nemo Tensor Insulated Regular (Sleeping Pads)
- Enlightened Equipment Enigma 20°F Regular (Sleeping Bags)

## npm script

Add `db:seed:local` script to `package.json`:

```json
"db:seed:local": "tsx --env-file=.env ./tools/seed.ts"
```
