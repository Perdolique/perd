# Error Handling

## Client-side Error Handling

```typescript
// ✅ Basic try/catch
try {
  await $fetch('/api/endpoint')
} catch (error) {
  console.error(error)
}

// ✅ Type-safe error handling with type guards
try {
  await $fetch('/api/endpoint')
} catch (error) {
  console.error(error)

  // Check for FetchError
  if (error instanceof FetchError) {
    return error.data.message
  }

  // Check for specific error types
  if (isRecord(error) && 'statusCode' in error) {
    if (error.statusCode === 404) {
      navigateTo('/not-found')
    }
  }
}

// ✅ Using composable for toast notifications
const { showErrorToast } = useApiErrorToast()

try {
  await $fetch('/api/endpoint')
} catch (error) {
  showErrorToast(error, 'Failed to load data')
}
```

## Server-side Error Handling

```typescript
// ✅ Use h3's createError
export default defineEventHandler(async (event) => {
  const item = await findItem(id)

  if (item === undefined) {
    throw createError({
      status: 404,
      message: `Item with ID ${id} not found`
    })
  }

  return item
})

// ✅ Guard clauses for authentication
export default defineEventHandler(async (event) => {
  const userId = event.context.session?.userId

  if (userId === undefined) {
    throw createError({ status: 401 })
  }

  // Continue with authenticated logic
})

// ✅ Validation errors with specific messages
if (name.length > 100) {
  throw createError({
    status: 400,
    message: 'Name must not exceed 100 characters'
  })
}

// ✅ Authorization checks
if (resource.creatorId !== userId) {
  throw createError({
    status: 403,
    message: 'You do not have permission to modify this resource'
  })
}
```

## Key Principles

- Use try/catch/finally for proper cleanup
- Type guards for client-side error handling
- createError for server-side errors
- Guard clauses early in functions
