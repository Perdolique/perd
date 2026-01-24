# Migrations Workflow

## Standard Workflow

1. **Modify schema** in `server/database/schema.ts`
2. **Generate migration**: `pnpm db:generate`
3. **Review migration** in `server/database/migrations/`
4. **Apply locally**: `pnpm db:migrate:local`
5. **Commit migration files** to git
6. **Deploy**: Migrations run automatically via GitHub Actions

## Commands

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations locally (uses .env)
pnpm db:migrate:local

# Apply migrations to production/staging
pnpm db:migrate

# Open Drizzle Studio (GUI)
pnpm db:studio

# Seed database
pnpm db:seed:local  # Local
pnpm db:seed        # Production/staging
```

## Important Notes

- Always review generated migrations before committing
- Migrations run automatically on deployment
- Use `pnpm db:studio` to inspect database state
- Seed scripts are in `tools/seed.ts`
