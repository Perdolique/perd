---
name: typescript-patterns
description: TypeScript patterns including path aliases, strict typing, type guards, and validation patterns. Use when working with TypeScript code, imports, interfaces, type definitions, or when user mentions types, interfaces, type guards, validation, Valibot, imports, path aliases, type safety, or type assertions.
license: Unlicense
---

# TypeScript Patterns

TypeScript patterns and strict typing rules.

## Quick Reference

- **Imports**: See [imports.md](references/imports.md) for path aliases (~/@, ~~/, #shared, #server)
- **Types**: See [types.md](references/types.md) for interfaces and when to use interface vs type
- **Type Guards**: See [guards.md](references/guards.md) for type predicates and runtime type checking
- **Type Assertions**: See [type-assertions.md](references/type-assertions.md) for avoiding `as` keyword
- **Validation**: See [validation.md](references/validation.md) for Valibot validation patterns

## Strict Typing Rules

- **NO `any` types** - always use proper types or `unknown`
- **Explicit return types** on exported functions
- **Use `unknown`** for uncertain types, then narrow with type guards
- **Import types separately**: `import type { ... }` when only importing types
