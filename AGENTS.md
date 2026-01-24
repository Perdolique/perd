# Perd - Outdoor Equipment Companion

A Nuxt 4 application deployed to Cloudflare Workers with Drizzle ORM and Neon PostgreSQL.

## Package Manager

**Always use `pnpm`** (version 10.28.1)

## Commands

### Development & Build

```bash
pnpm dev                    # Start development server
pnpm build                  # Production build (Nuxt + Cloudflare Workers)
pnpm generate               # Static site generation
pnpm preview                # Preview with Wrangler locally
pnpm test:typecheck         # Run TypeScript type checking (ONLY test command available)
```

### Database (Drizzle ORM)

```bash
pnpm db:generate            # Generate migrations from schema changes
pnpm db:migrate             # Run migrations (production/staging)
pnpm db:migrate:local       # Run migrations locally with .env file
pnpm db:seed                # Seed database (production/staging)
pnpm db:seed:local          # Seed database locally
pnpm db:studio              # Open Drizzle Studio GUI
pnpm db:drizzle             # Run drizzle-kit commands directly
```

### Deployment

```bash
pnpm deploy:staging         # Deploy to staging (Cloudflare)
pnpm deploy:production      # Deploy to production (Cloudflare)
pnpm deploy:versions:staging # Upload version to staging
```

### Running Tests

**No formal test framework** - Only TypeScript type checking via `pnpm test:typecheck`

- No Vitest, Jest, or testing library configured
- Pre-commit hook runs typecheck automatically
- To run a "single test": Not applicable (no test files exist)

## Project Structure

```text
/app/                   # Application code (Nuxt 4 convention)
  assets/styles/        # SCSS with auto-imported utilities
  composables/          # Vue composables
  layouts/              # Layout components
  middleware/           # Route middleware
  models/               # TypeScript interfaces/types
  pages/                # File-based routing
  utils/                # Utility functions
/server/                # Server-side code (Nitro, use #server alias)
  api/                  # API endpoints (file-based routing)
  database/             # Drizzle schema, relations, migrations
  middleware/           # Server middleware
  utils/                # Server utilities
/shared/                # Shared code between client/server (use #shared alias)
/types/                 # Global TypeScript definitions
/tools/                 # Development tools (migrate, seed)
/public/                # Static assets
```

## Import Conventions

### Path Aliases

- `~` or `~/` or `@/` - App directory (`/app/`)
- `~~/` - Project root
- `#shared` - Shared code directory (`/shared/`)
- `#server` - Server code directory (`/server/`)

## TypeScript Conventions

- NO `any` types - use proper types or `unknown`
- Explicit return types on exported functions
- Use `unknown` for uncertain types, then narrow with type guards
- Prefer `readonly` properties for models and interfaces

## Naming Conventions

- **camelCase**: Variables, functions, parameters
  - `checklistId`, `isDeleting`, `formatDate()`
- **PascalCase**: Components, interfaces, types, enums
  - `PerdButton.vue`, `BrandModel`, `EquipmentStatus`
- **kebab-case**: File names, CSS classes, API routes
  - `use-api-error-toast.ts`, `[brandId].delete.ts`
- **Prefixes**: Composables use `use*` (useChecklistStore, useToaster)

## Code Style

- **Prefer named functions** over arrow functions for exports/declarations
- **Always use async/await**, never `.then()`
- **Use try/catch/finally** for proper cleanup
- **Type guards** for client-side error handling
- **createError** for server-side errors

## Vue/Nuxt Patterns

- Use `<script lang="ts" setup>` with strict typing
- Prefer CSS modules over scoped styles
- Readonly properties for component props
- Explicit emit types for better type safety

## Database

- Use Drizzle ORM with PostgreSQL (Neon serverless)
- Schema in `server/database/schema.ts`
- Relations in `server/database/relations.ts`
- Use `db` from `event.context` in API routes
- Always use indexes on foreign keys
- ULID for primary keys


### Migrations

1. Modify schema in `server/database/schema.ts`
2. Run `pnpm db:generate` to create migration files
3. Run `pnpm db:migrate:local` to apply locally
4. Migrations run automatically on deployment via GitHub Actions

## Deployment Notes

- **Target**: Cloudflare Workers
- **Environments**: Production, Staging
- **Database**: Neon PostgreSQL (serverless, HTTP for queries, WebSocket for transactions)
- **CI/CD**: GitHub Actions handles build, migration, and deployment
- **Pre-commit**: Husky runs typecheck before commits
