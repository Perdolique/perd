# Category properties and enum options

**Purpose**: Manage property definitions (`category_properties`) and their enum options (`property_enum_options`) for a given category. This is more complex than basic reference data CRUD because it involves a parent-child relationship. Adding/removing properties can be done through the category endpoint or as standalone property endpoints — decide during implementation based on what feels simpler.

## Scope

- Add a property definition to a category (with dataType, unit, slug).
- Remove a property definition from a category (cascades to item property values).
- Manage enum options for enum-type properties (add/remove options).

## Considerations

- When a property is deleted, all `item_property_values` for that property are cascade-deleted. This is intentional but destructive — worth a confirmation in future UI.
- Enum options should be managed alongside their parent property to keep the API surface small.

## Files to create

Decided during implementation — either nested under categories or as standalone property endpoints.

## Depends on

- [04-categories](04-categories.md) — categories must exist before properties can be added.
