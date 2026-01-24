# Database Queries

Use the `db` instance from `event.context` (injected by middleware) in API routes.

Import `tables` for query builder or use `db.query` for relational queries.

```typescript
import { tables } from '#server/utils/database'
```

## Simple Queries (Relational API)

For simple queries without complex joins, use `db.query` relational API:

```typescript
export default defineEventHandler(async (event) => {
  const { db } = event.context
  const brandId = getRouterParam(event, 'brandId')

  // Find first (returns single record or undefined)
  const brand = await db.query.brands.findFirst({
    where: {
      id: Number(brandId)
    }
  })

  if (brand === undefined) {
    throw createError({
      status: 404,
      message: `Brand with ID ${brandId} not found`
    })
  }

  return brand
})
```

```typescript
// Find many (returns array)
export default defineEventHandler(async (event) => {
  const { db } = event.context
  const userId = event.context.session?.userId

  if (userId === undefined) {
    throw createError({ status: 401 })
  }

  const equipment = await db.query.equipment.findMany({
    where: {
      creatorId: userId
    },

    orderBy: { createdAt: 'desc' },
    limit: 50,

    columns: {
      id: true,
      name: true,
      createdAt: true
    },

    with: {
      brand: {
        columns: {
          id: true,
          name: true
        }
      }
    }
  })

  return equipment
})
```

## Query Builder (for complex queries)

For complex queries with custom joins, aggregations, or specific SQL needs, use query builder:

```typescript
import { eq, and, desc } from 'drizzle-orm'
import { tables } from '#server/utils/database'

export default defineEventHandler(async (event) => {
  const { db } = event.context

  // Complex join with custom selection
  const result = await db
    .select({
      equipmentId: tables.equipment.id,
      equipmentName: tables.equipment.name,
      brandName: tables.brands.name,
      typeName: tables.equipmentTypes.name
    })
    .from(tables.equipment)
    .leftJoin(
      tables.brands,
      eq(tables.equipment.brandId, tables.brands.id))
    .leftJoin(
      tables.equipmentTypes,
      eq(tables.equipment.equipmentTypeId, tables.equipmentTypes.id))
    .where(
      and(
        eq(tables.equipment.creatorId, userId),
        eq(tables.brands.verified, true)
      )
    )
    .orderBy(desc(tables.equipment.createdAt))
    .limit(50)

  return result
})
```

## Insert Operations

```typescript
export default defineEventHandler(async (event) => {
  const { db } = event.context
  const body = await readValidatedBody(event, bodySchema)
  const userId = event.context.session?.userId

  if (userId === undefined) {
    throw createError({ status: 401 })
  }

  const [newEquipment] = await db
    .insert(tables.equipment)
    .values({
      name: body.name,
      brandId: body.brandId,
      creatorId: userId
    })
    .returning()

  return newEquipment
})
```

## Update Operations

```typescript
export default defineEventHandler(async (event) => {
  const { db } = event.context
  const equipmentId = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, bodySchema)

  const [updated] = await db
    .update(tables.equipment)
    .set({
      name: body.name,
      updatedAt: new Date()
    })
    .where(
      eq(tables.equipment.id, equipmentId)
    )
    .returning()

  if (updated === undefined) {
    throw createError({ status: 404 })
  }

  return updated
})
```

## Delete Operations

```typescript
export default defineEventHandler(async (event) => {
  const { db } = event.context
  const brandId = getRouterParam(event, 'brandId')
  const userId = event.context.session?.userId

  // Check ownership before delete
  const [brand] = await db
    .select()
    .from(tables.brands)
    .where(
      and(
        eq(tables.brands.id, Number(brandId)),
        eq(tables.brands.creatorId, userId)
      )
    )

  if (brand === undefined) {
    throw createError({ status: 404 })
  }

  await db
    .delete(tables.brands)
    .where(eq(tables.brands.id, Number(brandId)))

  return { success: true }
})
```

## Transactions

```typescript
export default defineEventHandler(async (event) => {
  const { db } = event.context
  const body = await readValidatedBody(event, bodySchema)

  await db.transaction(async (tx) => {
    // Insert parent
    const [checklist] = await tx
      .insert(tables.checklists)
      .values({
        name: body.name,
        userId: body.userId
      })
      .returning()

    // Insert children
    await tx
      .insert(tables.checklistItems)
      .values(
        body.items.map((item) => ({
          checklistId: checklist.id,
          name: item.name
        }))
      )
  })

  return { success: true }
})
```

## Best Practices

- **Prefer `db.query` API** for simple queries with relations - cleaner syntax and better DX
- **Use query builder** for complex joins, aggregations, or custom SQL
- Always check for empty results and throw `createError`
- Guard clauses for authentication/authorization before queries
- Use `findFirst()` when expecting single result (adds LIMIT 1)
- Use `findMany()` with explicit `limit` for lists
- Specify `columns` to select only needed fields
- Use `with` to include relations instead of manual joins
- Use transactions for multi-table operations that must succeed/fail together
