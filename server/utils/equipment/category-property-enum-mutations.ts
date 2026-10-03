import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import type * as v from 'valibot'
import { itemPropertyValues, propertyEnumOptions } from '#server/database/schema'

import {
  propertiesConflict,
  type AdminCategoryProperty,
  type PropertiesTransaction
} from '#server/utils/equipment/category-properties'

import type { propertyEnumOptionMutationSchema } from '#server/utils/validation/schemas'

interface PropertyContribution {
  action: string;
  metadata: Record<string, unknown>;
  targetId: string;
}

type OptionSettings = v.InferOutput<typeof propertyEnumOptionMutationSchema>

type EnumMutation =
  | { action: 'create_option'; propertyId: number; settings: OptionSettings; }
  | { action: 'update_option'; propertyId: number; optionId: number; settings: OptionSettings; }
  | { action: 'delete_option'; propertyId: number; optionId: number; }

async function mutatePropertyEnumOption(transaction: PropertiesTransaction, property: AdminCategoryProperty, mutation: EnumMutation): Promise<PropertyContribution | null> {

  const option = mutation.action === 'create_option' ? undefined : property.enumOptions.find((entry) => entry.id === mutation.optionId)

  if (mutation.action !== 'create_option' && option === undefined) {
    throw createError({ status: 404 })
  }

  if (property.dataType !== 'enum') {
    throw createError({
      status: 400,
      message: 'Options require an enum characteristic.'
    })
  }

  if (mutation.action === 'delete_option' && option !== undefined) {
    if (option.usedItemCount > 0) {
      throw propertiesConflict('option_in_use', 'This option is used by items and cannot be deleted.')
    }

    if (property.enumOptions.length === 1) {
      throw propertiesConflict('last_enum_option', 'Keep at least one option.')
    }

    await transaction.delete(propertyEnumOptions).where(
      eq(propertyEnumOptions.id, option.id)
    )

    return {
      action: 'delete_property_enum_option',
      targetId: `${option.id}`,

      metadata: {
        propertyId: property.id,
        oldSettings: option
      }
    }
  }

  if (mutation.action === 'delete_option') {
    throw createError({ status: 404 })
  }

  const { settings } = mutation
  const duplicate = property.enumOptions.some((entry) => entry.id !== option?.id && entry.slug === settings.slug)

  if (duplicate) {
    throw propertiesConflict('option_slug_conflict', 'An option with this slug already exists.')
  }

  if (option === undefined) {
    const [created] = await transaction.insert(propertyEnumOptions)
      .values({
        propertyId: property.id,
        name: settings.name,
        slug: settings.slug
      })
      .returning({ id: propertyEnumOptions.id })

    if (created === undefined) {
      throw new Error('Enum option insert returned no row')
    }

    return {
      action: 'create_property_enum_option',
      targetId: `${created.id}`,

      metadata: {
        propertyId: property.id,
        newSettings: settings
      }
    }
  }

  if (option.name === settings.name && option.slug === settings.slug) {
    return null
  }

  await transaction.update(propertyEnumOptions).set(settings).where(
    eq(propertyEnumOptions.id, option.id)
  )

  if (option.slug !== settings.slug) {
    await transaction.update(itemPropertyValues)
      .set({ valueText: settings.slug })
      .where(
        and(eq(itemPropertyValues.propertyId, property.id), eq(itemPropertyValues.valueText, option.slug))
      )
  }

  return {
    action: 'update_property_enum_option',
    targetId: `${option.id}`,

    metadata: {
      propertyId: property.id,
      oldSettings: option,
      newSettings: settings,
      affectedItemCount: option.slug === settings.slug ? 0 : option.usedItemCount
    }
  }
}

export { mutatePropertyEnumOption }
export type { EnumMutation, PropertyContribution }
