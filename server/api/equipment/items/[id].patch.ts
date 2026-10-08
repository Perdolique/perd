import type { InferInput } from 'valibot'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody, type H3Event } from 'h3'
import { contributions, equipmentItems, itemPropertyValues } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  checkPropertiesRevision,
  lockPropertiesCategories,
  propertiesConflict,
  type PropertiesTransaction
} from '#server/utils/equipment/category-properties'

import { logCategoryWriteError } from '#server/utils/equipment/category-write-errors'

import {
  readEquipmentItemEditSnapshot,
  equipmentItemAuditSnapshot,
  type EquipmentItemEditResponse
} from '#server/utils/equipment/item-edit-snapshot'

import { normalizeEquipmentItemProperties } from '#server/utils/equipment/item-properties'

import {
  validateEquipmentItemUpdateBody,
  validateItemDetailParams,
  type equipmentItemUpdateBodySchema
} from '#server/utils/validation/schemas'

async function lockItemCategories(transaction: PropertiesTransaction, categoryIds: number[]) {
  try {
    return await lockPropertiesCategories(transaction, categoryIds)
  } catch (error) {
    if (isError(error) && error.statusCode === 404) {
      throw propertiesConflict('item_reference_conflict', 'The selected category is unavailable. Reload before saving.')
    }

    throw error
  }
}

export default defineEventHandler(async (event: H3Event<{ body: InferInput<typeof equipmentItemUpdateBodySchema>; }>): Promise<EquipmentItemEditResponse> => {
  const userId = await validateAdminUser(event)
  const { id } = await getValidatedRouterParams(event, validateItemDetailParams)
  const body = await readValidatedBody(event, validateEquipmentItemUpdateBody)
  let database: ReturnType<typeof createWebSocketClientFromEvent> | null = null

  try {
    database = createWebSocketClientFromEvent(event)

    return await database.transaction(async (transaction) => {
      const original = await transaction.query.equipmentItems.findFirst({
        columns: {
          categoryId: true
        },

        where: {
          id
        }
      })

      if (original === undefined) { throw createError({ status: 404 }) }

      const categories = await lockItemCategories(transaction, [original.categoryId, body.categoryId])

      const [item] = await transaction
        .select({
          categoryId: equipmentItems.categoryId,
          revision: equipmentItems.revision,
          status: equipmentItems.status
        })
        .from(equipmentItems)
        .where(
          eq(equipmentItems.id, id)
        )
        .for('update')

      if (item === undefined) { throw createError({ status: 404 }) }

      if (item.status !== 'approved') { throw propertiesConflict('item_status_conflict', 'This item is no longer published.') }

      if (item.revision !== body.expectedItemRevision || item.categoryId !== original.categoryId) {
        throw propertiesConflict('item_revision_conflict', 'This item changed since it was loaded. Reload before saving.')
      }

      const originalCategory = categories.find((category) => category.id === original.categoryId)
      const selectedCategory = categories.find((category) => category.id === body.categoryId)

      if (originalCategory === undefined || selectedCategory === undefined) {
        throw propertiesConflict('item_reference_conflict', 'The selected category is unavailable. Reload before saving.')
      }

      checkPropertiesRevision(originalCategory.propertiesRevision, body.expectedOriginalPropertiesRevision)
      checkPropertiesRevision(selectedCategory.propertiesRevision, body.expectedPropertiesRevision)

      if (item.categoryId !== body.categoryId && !body.categoryChangeConfirmed) {
        throw createError({
          status: 400,
          message: 'Confirm the category change before saving.'
        })
      }

      const before = await readEquipmentItemEditSnapshot(transaction, id)

      const brand = await transaction.query.brands.findFirst({
        columns: {
          id: true
        },

        where: {
          id: body.brandId
        }
      })

      const category = await transaction.query.equipmentCategories.findFirst({
        where: {
          id: body.categoryId
        },

        with: {
          properties: {
            with: {
              enumOptions: true
            }
          }
        }
      })

      if (brand === undefined || category === undefined) {
        throw propertiesConflict('item_reference_conflict', 'The selected brand or category is unavailable. Reload before saving.')
      }

      const normalized = normalizeEquipmentItemProperties(body.categoryId, category.properties, body.properties)

      const originalDefinitions = before.category.properties.map((property) => {
        return {
          id: property.id,
          categoryId: before.category.id,
          dataType: property.dataType,
          allowsNegativeValues: property.allowsNegativeValues,
          enumOptions: property.enumOptions ?? []
        }
      })

      const originalProperties = normalizeEquipmentItemProperties(before.category.id, originalDefinitions, before.properties)
      const sortedOriginal = originalProperties.toSorted((left, right) => left.propertyId - right.propertyId)
      const sortedNext = normalized.toSorted((left, right) => left.propertyId - right.propertyId)
      const hasSameProperties = JSON.stringify(sortedOriginal) === JSON.stringify(sortedNext)

      if (before.name === body.name && before.brand.id === body.brandId && before.category.id === body.categoryId && hasSameProperties) {
        return before
      }

      await transaction
        .update(equipmentItems)
        .set({
          name: body.name,
          brandId: body.brandId,
          categoryId: body.categoryId,
          revision: item.revision + 1
        })
        .where(
          eq(equipmentItems.id, id)
        )

      await transaction
        .delete(itemPropertyValues)
        .where(
          eq(itemPropertyValues.itemId, id)
        )

      if (normalized.length > 0) {
        const rows = normalized.map((property) => {
          return {
            itemId: id,
            propertyId: property.propertyId,
            valueText: property.valueText,
            valueNumber: property.valueNumber,
            valueBoolean: property.valueBoolean
          }
        })

        await transaction.insert(itemPropertyValues).values(rows)
      }

      const after = await readEquipmentItemEditSnapshot(transaction, id)
      const beforeAudit = equipmentItemAuditSnapshot(before)
      const afterAudit = equipmentItemAuditSnapshot(after)

      await transaction.insert(contributions).values({
        userId,
        targetId: id,
        action: 'update_equipment_item',

        metadata: {
          before: beforeAudit,
          after: afterAudit
        }
      })

      return after
    })
  } catch (error) {
    if (isError(error) && error.statusCode < 500) { throw error }

    logCategoryWriteError('Failed to edit published equipment item', error)

    let cause: unknown = error

    for (let depth = 0; depth < 4 && typeof cause === 'object' && cause !== null; depth += 1) {
      if (Reflect.get(cause, 'code') === '23503') {
        throw propertiesConflict('item_reference_conflict', 'Reference data changed. Reload before saving.')
      }

      cause = Reflect.get(cause, 'cause')
    }

    throw createError({
      status: 500,
      message: 'Could not save the item. Your edits are still here. Try again.'
    })
  } finally {
    try { await database?.$client.end() } catch (error) {
      logCategoryWriteError('Failed to close item edit database client', error)
    }
  }
})
