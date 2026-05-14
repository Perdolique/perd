# Packing lists MVP

**Purpose**: Add the first trip-oriented checklist workflow through a sequence of small, shippable iterations. The completed MVP lets a signed-in user create a packing list, add catalog-backed or custom entries, and mark entries as packed.

Catalog ownership is already shipped and summarized in [Completed work](completed.md), so packing work can reuse the existing catalog detail and personal inventory surfaces without a separate ownership iteration.

## MVP boundaries

- Packing list metadata stays name-only.
- Inventory remains catalog-backed only. Custom entries are allowed only inside packing lists.
- Do not add quantities, notes, weight totals, sharing, collaboration, templates, import/export, or packing analytics.
- Do not add packing-list actions to the `/catalog` browse table during this MVP.
- Do not change `/` behavior until the navigation decision iteration.

## Iteration 2: Custom checklist entries

**Result**: A signed-in user can make a packing list useful even when the catalog is incomplete.

**Scope**:

- Add `packing_list_entries` scoped to a packing list.
- Support custom entries with `customName` and `isPacked`.
- Add `GET /api/user/packing-lists/[id]` for one owned list and its entries.
- Add `POST /api/user/packing-lists/[id]/entries` for `{ customName }`.
- Add `PATCH /api/user/packing-lists/[id]/entries/[entryId]` for toggling `isPacked`.
- Add `DELETE /api/user/packing-lists/[id]/entries/[entryId]` for removing an entry.
- Ensure deleting a packing list also removes its entries.
- Add `/packs/[id]` with custom entry creation, packed toggle, and delete controls.

**Non-goals**:

- No `equipmentItemId` entries yet.
- No catalog detail integration.
- No quantities, notes, sections, or templates.

**Verification**:

- Unit coverage for entry validation, ownership scoping, toggling, and deletion.
- Focused Playwright coverage for adding a custom entry, toggling packed state, deleting it, and returning to the list shell.
- Run the same TypeScript, unit, lint, build, and focused e2e checks as Iteration 1.

**Completed summary**: Packing list detail shipped with custom checklist entries, packed toggles, and entry removal.

## Iteration 3: Catalog-backed packing entries

**Result**: A signed-in user can add an approved catalog item to an existing packing list from item detail.

**Scope**:

- Extend packing list entries so each row stores exactly one source: `equipmentItemId` for catalog-backed entries or `customName` for user-defined entries.
- Update entry creation to accept `{ equipmentItemId }` or `{ customName }`, rejecting both-or-neither payloads.
- Accept only approved catalog items for catalog-backed entries.
- Show catalog-backed entries on `/packs/[id]` using only fields needed by that page.
- Add a minimal "Add to packing list" action on `/catalog/[id]` with an existing-list target picker.

**Non-goals**:

- No packing actions on `/catalog` browse rows.
- No automatic inventory ownership changes.
- No new catalog read endpoint unless the existing item detail contract is proven insufficient for this action.

**Verification**:

- Unit coverage for both-or-neither source validation, approved-item checks, and ownership scoping.
- Focused Playwright coverage for adding a catalog item from `/catalog/[id]` and seeing it on the selected packing list.
- Run the same TypeScript, unit, lint, build, and focused e2e checks as earlier iterations.

**Completed summary**: Catalog detail can add approved items to existing packing lists, and packing list detail displays catalog-backed entries beside custom entries.

## Iteration 4: Packing navigation decision

**Result**: The app navigation reflects packing lists as the primary trip-planning workflow.

**Scope**:

- Add or adjust shell navigation so packing lists are easy to reach.
- Decide whether `/` remains a lightweight dashboard with a packing-list call to action or redirects to `/packs`.
- Update login redirect expectations and dashboard/navigation e2e coverage to match the chosen behavior.

**Non-goals**:

- No new packing list domain fields.
- No additional catalog discoverability controls.
- No admin catalog tooling.

**Verification**:

- Focused Playwright coverage for the chosen `/` and navigation behavior.
- Re-run packing-list and login/dashboard e2e specs affected by the route decision.
- Run the same TypeScript, unit, lint, build, and focused e2e checks as earlier iterations.

**Completed summary**: App navigation now treats packing lists as the primary trip-planning workflow, with `/` behavior aligned to the shipped product loop.

## MVP acceptance

- A signed-in user can create, rename, and delete a packing list.
- A signed-in user can add a custom entry directly on `/packs/[id]`.
- A signed-in user can toggle entries as packed and remove them.
- A signed-in user can add an approved catalog item to an existing packing list from `/catalog/[id]`.
- The flow remains useful even when the public catalog is incomplete.
