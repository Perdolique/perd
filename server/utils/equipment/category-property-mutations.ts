import { eq } from 'drizzle-orm'
import { createError } from 'nuxt/server'
import type * as v from 'valibot'
import { categoryProperties, contributions, equipmentCategories, propertyEnumOptions } from '#server/database/schema'

import {
  checkPropertiesRevision,
  propertiesConflict,
  readCategoryPropertiesSnapshot,
  type AdminCategoryProperty,
  type AdminCategoryPropertiesSnapshot,
  type PropertiesTransaction
} from '#server/utils/equipment/category-properties'

import {
  mutatePropertyEnumOption,
  type EnumMutation,
  type PropertyContribution
} from '#server/utils/equipment/category-property-enum-mutations'

import { writePropertyOrder } from '#server/utils/equipment/category-property-order'
import type { categoryPropertyUpdateSchema } from '#server/utils/validation/schemas'

type PropertySettings = v.InferOutput<typeof categoryPropertyUpdateSchema>

type PropertiesMutation = EnumMutation
  | { action: 'create'; settings: PropertySettings; }
  | { action: 'update'; propertyId: number; settings: PropertySettings; }
  | { action: 'delete'; propertyId: number; expectedAffectedItemCount: number; }
  | { action: 'order'; propertyIds: number[]; }

interface PropertyUpdateInput {
  settings: PropertySettings;
  property: AdminCategoryProperty;
}

interface PropertiesMutationContext {
  categoryId: number;
  expectedPropertiesRevision: number;
  userId: string;
}

function propertySettings(property: AdminCategoryProperty) {
  return {
    allowsNegativeValues: property.allowsNegativeValues,
    dataType: property.dataType,
    name: property.name,
    slug: property.slug,
    unit: property.unit
  }
}

async function insertOptions(transaction: PropertiesTransaction, propertyId: number, options: PropertySettings['enumOptions']) {
  if (options === undefined) {
    return
  }

  const rows = options.map((option) => {
    return {
      propertyId,
      name: option.name,
      slug: option.slug
    }
  })

  await transaction.insert(propertyEnumOptions).values(rows)
}

async function createProperty(transaction: PropertiesTransaction, before: AdminCategoryPropertiesSnapshot, settings: PropertySettings): Promise<PropertyContribution> {
  const duplicate = before.properties.some((property) => property.slug === settings.slug)

  if (duplicate) {
    throw propertiesConflict('property_slug_conflict', 'A characteristic with this slug already exists.')
  }

  let displayOrder = 0

  if (before.properties.length > 0) {
    const positions = before.properties.map((property) => property.displayOrder)
    const maximumPosition = Math.max(...positions)

    displayOrder = maximumPosition + 1
  }

  const [property] = await transaction.insert(categoryProperties).values({
    categoryId: before.category.id,
    displayOrder,
    allowsNegativeValues: settings.allowsNegativeValues,
    dataType: settings.dataType,
    name: settings.name,
    slug: settings.slug,
    unit: settings.unit ?? null
  }).returning({ id: categoryProperties.id })

  if (property === undefined) {
    throw new Error('Characteristic insert returned no row')
  }

  await insertOptions(transaction, property.id, settings.enumOptions)

  return {
    action: 'create_category_property',
    targetId: `${property.id}`,
    metadata: { newSettings: settings }
  }
}

async function updateProperty(transaction: PropertiesTransaction, properties: AdminCategoryProperty[], input: PropertyUpdateInput): Promise<PropertyContribution | null> {
  const { settings, property } = input
  const unit = settings.unit ?? null
  const duplicate = properties.some((entry) => entry.id !== property.id && entry.slug === settings.slug)

  if (duplicate) {
    throw propertiesConflict('property_slug_conflict', 'A characteristic with this slug already exists.')
  }

  const changesRepresentation = property.dataType !== settings.dataType || property.unit !== unit

  if (changesRepresentation && property.usedItemCount > 0) {
    throw propertiesConflict('property_in_use', 'Type and unit cannot change while items have values.')
  }

  if (!settings.allowsNegativeValues && property.negativeValueCount > 0) {
    throw propertiesConflict('negative_values_in_use', 'Negative values still exist for this characteristic.')
  }

  const becomesEnum = property.dataType !== 'enum' && settings.dataType === 'enum'

  if (becomesEnum && settings.enumOptions === undefined) {
    throw createError({
      status: 400,
      message: 'Add at least one option.'
    })
  }

  if (property.dataType === 'enum' && settings.enumOptions !== undefined) {
    throw createError({
      status: 400,
      message: 'Edit existing enum options separately.'
    })
  }

  const oldSettings = propertySettings(property)

  const newSettings = {
    allowsNegativeValues: settings.allowsNegativeValues,
    dataType: settings.dataType,
    name: settings.name,
    slug: settings.slug,
    unit
  }

  const settingsEntries = Object.entries(newSettings)
  const unchanged = settingsEntries.every(([key, value]) => Reflect.get(oldSettings, key) === value)

  if (unchanged) {
    return null
  }

  await transaction.update(categoryProperties).set(newSettings).where(
    eq(categoryProperties.id, property.id)
  )

  if (property.dataType === 'enum' && settings.dataType !== 'enum') {
    await transaction.delete(propertyEnumOptions).where(
      eq(propertyEnumOptions.propertyId, property.id)
    )
  }

  if (becomesEnum) {
    await insertOptions(transaction, property.id, settings.enumOptions)
  }

  return {
    action: 'update_category_property',
    targetId: `${property.id}`,

    metadata: {
      oldSettings,
      newSettings,
      oldEnumOptions: property.enumOptions,
      newEnumOptions: settings.enumOptions
    }
  }
}

async function changeProperties(transaction: PropertiesTransaction, before: AdminCategoryPropertiesSnapshot, mutation: PropertiesMutation): Promise<PropertyContribution | null> {
  if (mutation.action === 'order') {
    const ids = before.properties.map((property) => property.id)
    const included = new Set(mutation.propertyIds)

    if (included.size !== mutation.propertyIds.length || ids.length !== included.size || ids.some((id) => !included.has(id))) {
      throw createError({
        status: 400,
        message: 'Include every current characteristic exactly once.'
      })
    }

    const isSameOrder = before.properties.every((property, index) => property.id === mutation.propertyIds[index] && property.displayOrder === index)

    if (isSameOrder) {
      return null
    }

    await writePropertyOrder(transaction, before.properties, mutation.propertyIds)

    return {
      action: 'reorder_category_properties',
      targetId: `${before.category.id}`,

      metadata: {
        oldOrder: ids,
        newOrder: mutation.propertyIds
      }
    }
  }

  if (mutation.action === 'create') {
    return createProperty(transaction, before, mutation.settings)
  }

  const property = before.properties.find((entry) => entry.id === mutation.propertyId)

  if (property === undefined) {
    throw createError({ status: 404 })
  }

  if (mutation.action === 'update') {
    return updateProperty(transaction, before.properties, {
      settings: mutation.settings,
      property
    })
  }

  if (mutation.action !== 'delete') {
    return mutatePropertyEnumOption(transaction, property, mutation)
  }

  if (property.usedItemCount !== mutation.expectedAffectedItemCount) {
    throw propertiesConflict('affected_item_count_conflict', 'The number of affected items changed. Review the new count and confirm again.')
  }

  await transaction.delete(categoryProperties).where(
    eq(categoryProperties.id, property.id)
  )

  const remaining = before.properties.filter((entry) => entry.id !== property.id)
  const remainingIds = remaining.map((entry) => entry.id)

  await writePropertyOrder(transaction, remaining, remainingIds)

  return {
    action: 'delete_category_property',
    targetId: `${property.id}`,

    metadata: {
      oldSettings: propertySettings(property),
      enumOptions: property.enumOptions,
      affectedItemCount: property.usedItemCount
    }
  }
}

/** Atomic admin edits share one category lock, revision, contribution, and response snapshot. */
async function mutateCategoryProperties(transaction: PropertiesTransaction, context: PropertiesMutationContext, mutation: PropertiesMutation): Promise<AdminCategoryPropertiesSnapshot> {
  const { categoryId, expectedPropertiesRevision, userId } = context

  const [category] = await transaction
    .select({
      id: equipmentCategories.id,
      propertiesRevision: equipmentCategories.propertiesRevision
    })
    .from(equipmentCategories)
    .where(
      eq(equipmentCategories.id, categoryId)
    )
    .for('update')

  if (category === undefined) {
    throw createError({ status: 404 })
  }

  checkPropertiesRevision(category.propertiesRevision, expectedPropertiesRevision)

  const before = await readCategoryPropertiesSnapshot(transaction, categoryId)
  const change = await changeProperties(transaction, before, mutation)

  if (change === null) {
    return before
  }

  await transaction.update(equipmentCategories)
    .set({ propertiesRevision: category.propertiesRevision + 1 })
    .where(
      eq(equipmentCategories.id, categoryId)
    )

  await transaction.insert(contributions).values({
    userId,
    action: change.action,
    targetId: change.targetId,

    metadata: {
      categoryId,
      ...change.metadata
    }
  })

  return readCategoryPropertiesSnapshot(transaction, categoryId)
}

export { mutateCategoryProperties }
