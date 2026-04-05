# Frontend

**Purpose**: Build the UI for browsing the equipment catalog, viewing item details, and managing personal inventory. This phase depends on the backend APIs (browsing, admin, user inventory) being ready. To be planned separately — will need pages (Nuxt file-based routing), components (follow conventions in `.agents/skills/vue-components/SKILL.md`), and composables for data fetching. Scope includes: catalog browsing pages, item detail page, user inventory page, admin management pages.

Pages may compose multiple independent read requests when that keeps API contracts simpler. For example, a brand page can fetch brand metadata from `GET /api/equipment/brands/[slug]` and brand items from `GET /api/equipment/items?brandSlug=...`. Keep this strategy library-agnostic for now; choose any future query/cache layer only when a concrete frontend scenario needs it.
