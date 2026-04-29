# Admin catalog operations

**Purpose**: Keep item create/edit/delete work intentionally out of the near-term MVP while documenting when it should return.

## Current position

- Reference-data admin is already shipped for brands, groups, categories, category properties, and enum options.
- Item lifecycle tooling for admins is intentionally deferred.
- The public MVP should not depend on a full admin item dashboard before users can browse, own, and pack gear.

## Deferred scope

- Admin item creation
- Admin item editing
- Admin item deletion
- Minimal admin UI for those item operations

## Return conditions

- Revisit this slice only when catalog maintenance becomes a proven blocker for the user-facing MVP.
- If the blocker is only missing catalog entries, restore the smallest useful slice first: item creation.
- Do not revive a full create/edit/delete roadmap by default.

## Shared rules for a future return

- Reuse `validateAdminUser(event)`.
- Keep contribution logging for admin writes.
- Keep item writes tightly scoped to the current catalog model. No variants, bulk tools, or speculative moderation workflows without a concrete need.
