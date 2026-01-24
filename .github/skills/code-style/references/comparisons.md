# Explicit Comparisons

**Always use explicit comparisons** instead of implicit boolean coercion to avoid type conversion issues.

## Explicit vs Implicit Comparisons

```typescript
// ❌ Avoid implicit boolean coercion
if (!value) { }
if (!user) { }
if (!items.length) { }

// ✅ Use explicit comparisons
if (value === undefined) { }
if (value === null) { }
if (user === undefined) { }
if (items.length === 0) { }
```

## Checking for null/undefined

```typescript
// ❌ Avoid negation
if (!user) {
  return null
}

// ✅ Explicit check
if (user === undefined || user === null) {
  return null
}

// ✅ Or if only checking undefined
if (user === undefined) {
  return null
}
```

## Checking boolean values

```typescript
// ❌ Implicit
if (!isActive) { }
if (!!flag) { }

// ✅ Explicit
if (isActive === false) { }
if (flag === true) { }
```

## Array length checks

```typescript
// ❌ Implicit
if (!items.length) {
  return []
}

// ✅ Explicit
if (items.length === 0) {
  return []
}
```

## Optional values

```typescript
// ❌ Implicit negation
const brand = await findBrand(id)

if (!brand) {
  throw createError({ status: 404 })
}

// ✅ Explicit undefined check
const brand = await findBrand(id)

if (brand === undefined) {
  throw createError({ status: 404 })
}
```

## Inequality checks

```typescript
// ❌ Using negation
if (!(index === -1)) { }

// ✅ Use !== operator
if (index !== -1) { }

// ✅ Ownership check
if (resource.creatorId !== userId) {
  throw createError({ status: 403 })
}
```

## Special cases

```typescript
// ✅ For NaN checks
if (isNaN(value) === false) { }

// ✅ For null checks in object properties
if (value !== null && typeof value === 'object') { }

// ✅ For array find results
const item = items.find(item => item.id === id)

if (item === undefined) {
  console.log('Not found')
}
```

## Why Explicit Comparisons?

1. **No type coercion** - Avoids JavaScript's implicit conversions (0, '', [], etc.)
2. **Clear intent** - Obvious what value you're checking for
3. **Type safety** - Works better with TypeScript's strict mode
4. **Predictable** - No surprises with falsy values
