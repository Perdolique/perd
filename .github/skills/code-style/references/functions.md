# Function Declarations

**Prefer named functions over arrow functions** for exports and declarations.
**Always use explicit comparisons** instead of implicit boolean coercion.

## Named Functions (Preferred)

```typescript
// ✅ Preferred for composables
export default function useApiErrorToast() {
  function showErrorToast(error: unknown, title: string) {
    // Implementation
  }

  return { showErrorToast }
}

// ✅ Preferred for standalone functions
export function formatDate(date: Date) : string {
  return date.toISOString()
}

// ✅ Preferred for utilities
export function calculateTotal(items: number[]) : number {
  return items.reduce((sum, item) => sum + item, 0)
}
```

## Arrow Functions (Avoid for Declarations)

```typescript
// ❌ Avoid for exports and named declarations
const showErrorToast = (error: unknown) => {
  // ...
}

// ❌ Avoid for composable exports
export default () => {
  const toast = useToaster()

  return { toast }
}
```

## Arrow Functions (OK for Callbacks)

```typescript
// ✅ OK for inline callbacks
items.map((item) => ({ id: item.id, name: item.name }))

// ✅ OK for array methods
const active = items.filter((item) => item.active)
```
