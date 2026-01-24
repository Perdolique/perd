# Type Guards

Type guards enable runtime type checking and type narrowing in TypeScript.

## Type Predicates

```typescript
// ✅ Custom type guards for common checks
export function isRecord(value: unknown) : value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isString(value: unknown) : value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown) : value is number {
  return typeof value === 'number' && isNaN(value) === false
}
```

## Built-in Type Guards

```typescript
// ✅ instanceof for class/DOM instances
function handleInput(event: Event) {
  const target = event.target

  if (target instanceof HTMLInputElement) {
    console.log(target.value) // TypeScript knows this is HTMLInputElement
  }
}

// ✅ typeof for primitives
function processValue(value: unknown) {
  if (typeof value === 'string') {
    console.log(value.toUpperCase())
  }

  if (typeof value === 'number') {
    console.log(value.toFixed(2))
  }
}

// ✅ in operator for property checks
function handleResponse(response: unknown) {
  if (
    typeof response === 'object' &&
    response !== null &&
    'data' in response
  ) {
    console.log(response.data)
  }
}
```

## Custom Type Guards for Models

```typescript
// ✅ Type guard for API responses
function isBrandResponse(data: unknown): data is BrandModel {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    typeof data.id === 'number' &&
    typeof data.name === 'string'
  )
}

// Usage
const response = await $fetch('/api/brands/1')

if (isBrandResponse(response)) {
  console.log(response.name) // Safely typed as BrandModel
}
```

## Type Narrowing

```typescript
// ✅ Narrowing with null/undefined checks
function getDisplayName(name: string | null | undefined) : string {
  if (name === null || name === undefined) {
    return 'Unknown'
  }

  return name // TypeScript knows this is string
}

// ✅ Array.isArray for arrays
function processItems(data: unknown) {
  if (Array.isArray(data)) {
    data.forEach((item) => console.log(item)) // TypeScript knows this is array
  }
}
```

## Best Practices

- Use type guards to narrow `unknown` types safely
- Prefer built-in type guards (`instanceof`, `typeof`, `in`) when possible
- Create custom type predicates for complex model validation
- Combine multiple checks for thorough validation
- Type guards help narrow `unknown` to specific types

## When to Use Type Guards vs Validation

- **Type guards**: Quick runtime type checks, client-side narrowing
- **Valibot validation**: Complex server-side validation with detailed errors (see validation.md)
