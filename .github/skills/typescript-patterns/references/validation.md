# Valibot Validation

Use Valibot for server-side validation with detailed error messages.

## Request Body Validation

```typescript
import * as v from 'valibot'
import { limits } from '~~/constants'

// ✅ Define schema
const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxBrandNameLength)
  ),

  websiteUrl: v.optional(
    v.pipe(
      v.string(),
      v.url()
    )
  ),

  description: v.optional(
    v.string()
  )
})

// ✅ Extract validator function
function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

// ✅ Use in event handler
export default defineEventHandler(async (event) => {
  const { name, websiteUrl } = await readValidatedBody(event, validateBody)
  // ...
})
```

## Query Parameter Validation

```typescript
import * as v from 'valibot'

const querySchema = v.object({
  page: v.optional(
    v.pipe(
      v.string(),
      v.transform(Number),
      v.number(),
      v.minValue(1)
    )
  ),

  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform(Number),
      v.number(),
      v.minValue(1),
      v.maxValue(100)
    )
  )
})

function validateQuery(query: unknown) {
  return v.parse(querySchema, query)
}

export default defineEventHandler(async (event) => {
  const { page, limit } = await getValidatedQuery(event, validateQuery)
  // ...
})
```

## Complex Validation

```typescript
import * as v from 'valibot'

// Define schema with nested objects
const BrandSchema = v.object({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  name: v.pipe(v.string(), v.nonEmpty(), v.maxLength(100)),
  website: v.optional(v.pipe(v.string(), v.url())),
  createdAt: v.pipe(v.string(), v.isoTimestamp())
})

// Validator function with safeParse for detailed errors
function validateBrand(data: unknown) {
  return v.safeParse(BrandSchema, data)
}

// Usage
const response = await $fetch('/api/brands/1')
const result = validateBrand(response)

if (result.success) {
  console.log(result.output.name) // Fully typed and validated
} else {
  console.error('Validation failed:', result.issues)
}
```

## Best Practices

- Use Valibot for server-side validation only
- Extract validator function separately (don't inline `v.parse`)
- Use `v.nonEmpty()` instead of `v.minLength(1)` for clarity
- Use `v.pipe()` for chaining validations
- Reference `limits` from constants for max lengths
- Never trust input data - always validate

## When to Use Valibot

- Complex nested objects
- Multiple fields with constraints (length, range, format)
- Need detailed error messages
- API response validation
- User input validation on server
