# Database Relations

Define relations in `server/database/relations.ts` using Drizzle relations API.

**Official Docs**: [Drizzle Relations Schema Declaration](https://orm.drizzle.team/docs/relations-schema-declaration)

## One-to-Many Relations

```typescript
import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  users: {
    equipment: r.many.equipment({
      from: r.users.id,
      to: r.equipment.creatorId
    }),

    checklists: r.many.checklists({
      from: r.users.id,
      to: r.checklists.userId
    })
  },

  brands: {
    equipment: r.many.equipment({
      from: r.brands.id,
      to: r.equipment.brandId
    })
  }
}))
```

## Many-to-One Relations

```typescript
export const relations = defineRelations(schema, (r) => ({
  equipment: {
    creator: r.one.users({
      from: r.equipment.creatorId,
      to: r.users.id
    }),

    brand: r.one.brands({
      from: r.equipment.brandId,
      to: r.brands.id
    })
  }
}))
```
