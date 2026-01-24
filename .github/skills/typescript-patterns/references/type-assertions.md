# Type Assertions

## No Type Assertions (`as`)

Type assertions with `as` bypass TypeScript's type checking and should be avoided.

### ❌ Wrong

```typescript
// Using 'as' type casting
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement

  console.log(target.value)
}

// Forcing type conversion
const data = response as UserData

// Casting to any then to specific type
const element = document.getElementById('id') as any as CustomElement
```

### ✅ Correct

Use type guards and runtime checks instead:

```typescript
// Using instanceof type guard
function handleInput(event: Event) {
  const target = event.target

  if (target instanceof HTMLInputElement) {
    console.log(target.value) // TypeScript knows this is HTMLInputElement
  }
}

// Using custom type guard
function isUserData(data: unknown) : data is UserData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data
  )
}

const response = await fetch('/api/user')
const data = await response.json()

if (isUserData(data)) {
  console.log(data.name) // TypeScript knows this is UserData
}

// Using element type checks
const element = document.getElementById('myInput')

if (element instanceof HTMLInputElement) {
  element.value = 'new value'
}
```

### Exception: Const Assertions

The only acceptable use of `as` is for const assertions:

```typescript
// ✅ Correct - const assertion
const config = {
  status: 'active',
  priority: 'high'
} as const

// This makes the object deeply readonly and literal types
```

## Why Avoid `as`

1. **Bypasses type checking**: Compiler trusts you blindly
2. **Runtime errors**: No guarantee the assertion is correct
3. **Maintenance issues**: Hard to track when types change
4. **Better alternatives**: Type guards provide runtime safety
