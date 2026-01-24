---
name: database
description: Database patterns using Drizzle ORM with PostgreSQL. Includes schema definitions, relations, migrations workflow, and querying patterns in API routes. Use when working with database schema, queries, migrations, or when user mentions Drizzle, PostgreSQL, tables, relations, migrations, schema, SQL, database queries, transactions, or DB operations.
license: Unlicense
---

# Database Patterns

Drizzle ORM with PostgreSQL (Neon serverless). All database code lives in `server/database/`.

## Quick Reference

- **Schema**: See [schema-patterns.md](references/schema-patterns.md) for table definitions, foreign keys, enums, and JSON fields
- **Formatting**: See [formatting.md](references/formatting.md) for Drizzle schema formatting rules
- **Relations**: See [relations.md](references/relations.md) for one-to-many and many-to-one patterns
- **Queries**: See [queries.md](references/queries.md) for select, insert, update, delete, and transactions
- **Migrations**: See [migrations.md](references/migrations.md) for workflow and commands

## Core Principles

- Always use indexes on foreign keys
- ULID primary keys with `ulid()` helper
- Timestamps with timezone and auto-update
- Use `db` from `event.context` in API routes
- Validate with Valibot before DB operations
- Guard clauses for auth checks
- Transactions for multi-table operations
