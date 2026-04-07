import { brands, categoryProperties, equipmentCategories, equipmentGroups, propertyEnumOptions } from '#server/database/schema'

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

const categoryPropertyBaseSelection = {
  id: categoryProperties.id,
  name: categoryProperties.name,
  slug: categoryProperties.slug,
  dataType: categoryProperties.dataType,
  unit: categoryProperties.unit
}

type CategoryPropertyBaseRecord = Pick<typeof categoryProperties.$inferSelect, 'id' | 'name' | 'slug' | 'dataType' | 'unit'>

const propertyEnumOptionBaseSelection = {
  id: propertyEnumOptions.id,
  name: propertyEnumOptions.name,
  slug: propertyEnumOptions.slug
}

type PropertyEnumOptionBaseRecord = Pick<typeof propertyEnumOptions.$inferSelect, 'id' | 'name' | 'slug'>

export {
  brandBaseSelection,
  categoryBaseSelection,
  categoryPropertyBaseSelection,
  groupBaseSelection,
  propertyEnumOptionBaseSelection
}

export type {
  BrandBaseRecord,
  CategoryPropertyBaseRecord,
  CategoryBaseRecord,
  EquipmentGroupBaseRecord,
  PropertyEnumOptionBaseRecord
}
