# Async/Await Patterns

**Always use async/await, never `.then()` chains.**

## Client-side Async Operations

```typescript
// ✅ Preferred pattern with try/catch/finally
async function deleteChecklist() {
  try {
    isDeleting.value = true

    await $fetch(`/api/checklists/${checklistId}`, { method: 'DELETE' })

    navigateTo('/checklists')
  } catch (error) {
    console.error(error)
    // Handle error (see Error Handling section)
  } finally {
    isDeleting.value = false
  }
}

// ✅ Multiple sequential operations
async function loadData() {
  const user = await $fetch('/api/user')
  const equipment = await $fetch(`/api/users/${user.id}/equipment`)

  return { user, equipment }
}

// ✅ Parallel operations with Promise.all
async function loadMultiple() {
  const [brands, types] = await Promise.all([
    $fetch('/api/brands'),
    $fetch('/api/equipment-types')
  ])

  return { brands, types }
}
```

## Server-side Async Operations

```typescript
// ✅ API route handlers
export default defineEventHandler(async (event) => {
  const { db } = event.context

  const items = await db
    .select()
    .from(tables.items)
    .where(eq(tables.items.userId, userId))

  return items
})

// ✅ Database transactions
async function createWithRelation() {
  await db.transaction(async (tx) => {
    const [parent] = await tx.insert(tables.parents).values({ name }).returning()

    await tx.insert(tables.children).values({ parentId: parent.id })
  })
}
```

## Anti-pattern: .then() Chains

```typescript
// ❌ Never use .then() chains
$fetch('/api/endpoint')
  .then((data) => processData(data))
  .then(() => navigateTo('/success'))
  .catch((error) => console.error(error))

// ✅ Use async/await instead
try {
  const data = await $fetch('/api/endpoint')

  processData(data)
  navigateTo('/success')
} catch (error) {
  console.error(error)
}
```
