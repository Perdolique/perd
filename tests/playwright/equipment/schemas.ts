import * as v from 'valibot'

const groupSchema = v.object({
  id: v.number(),
  name: v.string(),
  slug: v.string()
})

const groupsSchema = v.array(groupSchema)

const categorySchema = v.object({
  id: v.number(),
  name: v.string(),
  slug: v.string()
})

const categoriesSchema = v.array(categorySchema)

const enumOptionSchema = v.object({
  id: v.number(),
  name: v.string(),
  slug: v.string()
})

const propertySchema = v.object({
  id: v.number(),
  name: v.string(),
  slug: v.string(),
  dataType: v.string(),
  unit: v.nullable(v.string()),
  enumOptions: v.optional(v.array(enumOptionSchema))
})

const categoryDetailSchema = v.object({
  id: v.number(),
  name: v.string(),
  slug: v.string(),
  properties: v.array(propertySchema)
})

const brandSchema = v.object({
  id: v.number(),
  name: v.string(),
  slug: v.string()
})

const brandsSchema = v.array(brandSchema)

const brandItemSchema = v.object({
  id: v.string(),
  name: v.string(),
  category: v.object({
    name: v.string(),
    slug: v.string()
  })
})

const brandDetailSchema = v.object({
  id: v.number(),
  name: v.string(),
  slug: v.string(),
  items: v.array(brandItemSchema)
})

const itemSummarySchema = v.object({
  id: v.string(),
  name: v.string(),
  brand: v.object({
    name: v.string(),
    slug: v.string()
  }),
  category: v.object({
    name: v.string(),
    slug: v.string()
  })
})

const itemsPageSchema = v.object({
  items: v.array(itemSummarySchema),
  total: v.number(),
  page: v.number(),
  limit: v.number()
})

const itemPropertySchema = v.object({
  name: v.string(),
  slug: v.string(),
  dataType: v.string(),
  unit: v.nullable(v.string()),
  value: v.nullable(v.string())
})

const itemDetailSchema = v.object({
  id: v.string(),
  name: v.string(),
  status: v.string(),
  createdAt: v.string(),
  brand: v.object({
    id: v.number(),
    name: v.string(),
    slug: v.string()
  }),
  category: v.object({
    id: v.number(),
    name: v.string(),
    slug: v.string()
  }),
  properties: v.array(itemPropertySchema)
})

export {
  brandDetailSchema,
  brandsSchema,
  categoriesSchema,
  categoryDetailSchema,
  groupsSchema,
  itemDetailSchema,
  itemsPageSchema
}
