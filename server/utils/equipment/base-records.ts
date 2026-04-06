import { brands, equipmentCategories, equipmentGroups } from '#server/database/schema'

const groupBaseSelection = {
  id: equipmentGroups.id,
  name: equipmentGroups.name,
  slug: equipmentGroups.slug
}

type EquipmentGroupBaseRecord = Pick<typeof equipmentGroups.$inferSelect, 'id' | 'name' | 'slug'>

const categoryBaseSelection = {
  id: equipmentCategories.id,
  name: equipmentCategories.name,
  slug: equipmentCategories.slug
}

type CategoryBaseRecord = Pick<typeof equipmentCategories.$inferSelect, 'id' | 'name' | 'slug'>

const brandBaseSelection = {
  id: brands.id,
  name: brands.name,
  slug: brands.slug
}

type BrandBaseRecord = Pick<typeof brands.$inferSelect, 'id' | 'name' | 'slug'>

export {
  brandBaseSelection,
  categoryBaseSelection,
  groupBaseSelection
}

export type {
  BrandBaseRecord,
  CategoryBaseRecord,
  EquipmentGroupBaseRecord
}
