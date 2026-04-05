import { brands, equipmentGroups } from '#server/database/schema'

const groupBaseSelection = {
  id: equipmentGroups.id,
  name: equipmentGroups.name,
  slug: equipmentGroups.slug
}

type EquipmentGroupBaseRecord = Pick<typeof equipmentGroups.$inferSelect, 'id' | 'name' | 'slug'>

const brandBaseSelection = {
  id: brands.id,
  name: brands.name,
  slug: brands.slug
}

type BrandBaseRecord = Pick<typeof brands.$inferSelect, 'id' | 'name' | 'slug'>

export {
  brandBaseSelection,
  groupBaseSelection
}

export type {
  BrandBaseRecord,
  EquipmentGroupBaseRecord
}
