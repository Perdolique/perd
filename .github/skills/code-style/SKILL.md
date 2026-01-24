---
name: code-style
description: Code style patterns including function declarations, async/await patterns, and error handling for both client and server. Use when writing or reviewing code, implementing functions, handling errors, formatting code, or when user mentions style, patterns, async, await, error handling, try/catch, comparisons, or naming conventions.
license: Unlicense
---

# Code Style

Core code style patterns for consistent codebase.

## Quick Reference

- **Functions**: See [functions.md](references/functions.md) - named functions over arrow functions for declarations
- **Async/Await**: See [async.md](references/async.md) - always async/await, never .then()
- **Error Handling**: See [errors.md](references/errors.md) - try/catch/finally with type guards
- **Comparisons**: See [comparisons.md](references/comparisons.md) - explicit comparisons, no implicit coercion
- **Formatting**: See [formatting.md](references/formatting.md) - code formatting rules (Drizzle schemas, Vue files, spacing)
- **Naming**: See [naming.md](references/naming.md) - no abbreviations, descriptive names

## Core Principles

- Named functions for exports and declarations
- Arrow functions only for inline callbacks
- async/await always, never `.then()`
- try/catch/finally for proper cleanup
- Type guards for client-side errors
- createError for server-side errors
- Explicit return types on exported functions
- Explicit comparisons (`=== undefined`, `=== null`, `=== false` `!==`) over implicit (`!value`)
