# Seed data

**Status**: Implemented.

**Purpose**: Populate the catalog with deterministic reference data and sample items so browsing, admin flows, and PR staging databases are immediately usable. The seed also acts as living documentation of how the current EAV model is written in practice.

## Current behavior

- Uses the same DB connection pattern as `tools/migrate.ts`: WebSocket client from `server/utils/database.ts` + env config from `server/utils/config-env.ts`.
- Resets only the catalog graph with `drizzle-seed reset()`: groups, categories, brands, category properties, enum options, items, item property values, user equipment, contributions.
- Seeds reference rows through `drizzle-seed` and then inserts the dependent EAV rows with plain Drizzle queries.
- Uses deterministic seed data, not random fixtures.
- Supports both local and CI/staging entrypoints:

```json
"db:seed": "tsx ./tools/seed.ts",
"db:seed:local": "tsx --env-file=.env ./tools/seed.ts"
```

- `db:seed` runs in the PR staging database workflow after migrations.

## Data definitions

### Groups

The current seed populates these functional navigation groups:

Shelter, Sleep, Packing, Cooking, Water, Clothing, Footwear, Navigation, Lighting, Electronics, Trekking, Safety.

### Categories

The current seed intentionally keeps the first slice small:

- Sleeping Bags
- Sleeping Pads
- Tents
- Stoves
- Water Filters

### Properties

Each seeded category has explicit property definitions with `dataType` and optional `unit`.

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

Tents:

- Weight (number, g)
- Capacity (number)
- Freestanding (boolean)

Stoves:

- Weight (number, g)
- Fuel Type (enum: canister/alcohol/liquid-fuel)
- Integrated Pot (boolean)

Water Filters:

- Weight (number, g)
- Filter Type (enum: squeeze/pump/gravity)
- Squeeze Compatible (boolean)

### Brands

Therm-a-Rest, Nemo, Sea to Summit, MSR, Big Agnes, Zpacks, Gossamer Gear, Enlightened Equipment.

### Sample items

The current seed includes deterministic item examples that cover all currently used seeded property types:

- Therm-a-Rest NeoAir XLite NXT Regular (Sleeping Pads)
- Nemo Tensor Insulated Regular (Sleeping Pads)
- Enlightened Equipment Enigma 20F Regular (Sleeping Bags)
- Big Agnes Copper Spur HV UL2 (Tents)
- MSR PocketRocket Deluxe (Stoves)
- MSR Guardian Purifier (Water Filters)

## Validation guarantees

- Sample item values are stored explicitly in the seed data as `valueText`, `valueNumber`, or `valueBoolean`.
- The seed validates that each sample property fills exactly one value column.
- The seed validates that the filled column matches the property `dataType`.
- The seed validates that every currently seeded property has sample coverage.
- `text` remains supported by schema, but the current seed does not define any `text` properties yet.
