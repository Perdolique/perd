# Naming Conventions

## No Abbreviations

Always use full, descriptive names. Avoid abbreviations.

### ❌ Wrong

```typescript
// Single-letter or abbreviated names
const e = new Error()
const v = getValue()
const val = input.value
const i = items[0]
const err = handleError()
```

### ✅ Correct

```typescript
// Full descriptive names
const error = new Error()
const value = getValue()
const itemValue = input.value
const item = items[0]
const error = handleError()
```

## Array Methods

Use descriptive names in array methods:

```typescript
// ❌ Wrong
items.findIndex((i) => i.id === id)

// ✅ Correct
items.findIndex((item) => item.id === id)
```

## Function Parameters

Event handlers and callbacks should use descriptive parameter names:

```typescript
// ❌ Wrong
function handleInput(e: Event) {
  const target = e.target
}

// ✅ Correct
function handleInput(event: Event) {
  const target = event.target
}
```

## Catch Block Variables

Use descriptive names in catch blocks:

```typescript
// ❌ Wrong
try {
  await fetchData()
} catch (e) {
  console.error(e)
}

// ✅ Correct
try {
  await fetchData()
} catch (error) {
  console.error(error)
}

// Or with shadowing prevention
try {
  await fetchData()
} catch (caughtError) {
  console.error(caughtError)
}
```
