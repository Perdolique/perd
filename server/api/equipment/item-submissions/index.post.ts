import { and, eq, inArray, ne } from 'drizzle-orm'
import { createError, defineEventHandler, isError, readValidatedBody, setResponseStatus } from 'h3'

import {
  brands,
  categoryProperties,
  contributions,
  equipmentCategories,
  equipmentItems,
  itemPropertyValues,
  propertyEnumOptions,
  userEquipment
} from '#server/database/schema'

import { createWebSocketClientFromEvent } from '#server/utils/config'
import {
  normalizePropertyValues,
  type SubmittedItemProperty
} from '#server/utils/equipment/item-submission-properties'
import { validateSessionUser } from '#server/utils/session'
import { validateItemSubmissionCreateBody } from '#server/utils/validation/schemas'

interface CatalogEntitySummary {
  name: string;
  slug: string;
}

interface SubmittedItem {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  createdAt: Date | string;
  id: string;
  name: string;
  properties: SubmittedItemProperty[];
  status: string;
}

interface InventoryItemSummary {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  id: string;
  name: string;
}

interface InventoryRecord {
  createdAt: Date | string;
  id: string;
  item: InventoryItemSummary;
}

interface ItemSubmissionCreateResponse {
  inventory: InventoryRecord;
  item: SubmittedItem;
}

export default defineEventHandler(async (event) : Promise<ItemSubmissionCreateResponse> => {
  const userId = await validateSessionUser(event)
  const body = await readValidatedBody(event, validateItemSubmissionCreateBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    const response = await dbWebsocket.transaction(async (transaction) => {
      const [brand] = await transaction
        .select({
          id: brands.id,
          name: brands.name,
          slug: brands.slug
        })
        .from(brands)
        .where(
          eq(brands.id, body.brandId)
        )
        .limit(1)

      if (brand === undefined) {
        throw createError({ status: 404 })
      }

      const [category] = await transaction
        .select({
          id: equipmentCategories.id,
          name: equipmentCategories.name,
          slug: equipmentCategories.slug
        })
        .from(equipmentCategories)
        .where(
          eq(equipmentCategories.id, body.categoryId)
        )
        .limit(1)

      if (category === undefined) {
        throw createError({ status: 404 })
      }

      const [duplicateItem] = await transaction
        .select({
          id: equipmentItems.id
        })
        .from(equipmentItems)
        .where(
          and(
            eq(equipmentItems.brandId, body.brandId),
            eq(equipmentItems.categoryId, body.categoryId),
            eq(equipmentItems.name, body.name),
            ne(equipmentItems.status, 'rejected')
          )
        )
        .limit(1)

      if (duplicateItem !== undefined) {
        throw createError({
          status: 409,
          message: 'Item already exists or is already pending review'
        })
      }

      const categoryPropertiesList = await transaction
        .select({
          dataType: categoryProperties.dataType,
          id: categoryProperties.id,
          name: categoryProperties.name,
          slug: categoryProperties.slug,
          unit: categoryProperties.unit
        })
        .from(categoryProperties)
        .where(
          eq(categoryProperties.categoryId, body.categoryId)
        )

      const enumPropertyIds = categoryPropertiesList
        .filter((property) => property.dataType === 'enum')
        .map((property) => property.id)

      const enumOptions = enumPropertyIds.length === 0
        ? []
        : await transaction
          .select({
            propertyId: propertyEnumOptions.propertyId,
            slug: propertyEnumOptions.slug
          })
          .from(propertyEnumOptions)
          .where(
            inArray(propertyEnumOptions.propertyId, enumPropertyIds)
          )

      const normalizedProperties = normalizePropertyValues(
        categoryPropertiesList,
        enumOptions,
        body.properties
      )

      const [createdItem] = await transaction
        .insert(equipmentItems)
        .values({
          brandId: body.brandId,
          categoryId: body.categoryId,
          createdBy: userId,
          name: body.name,
          status: 'pending'
        })
        .returning({
          createdAt: equipmentItems.createdAt,
          id: equipmentItems.id,
          name: equipmentItems.name,
          status: equipmentItems.status
        })

      if (createdItem === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to create submitted item'
        })
      }

      const propertyValueRows = normalizedProperties.map((property) => {
        return {
          itemId: createdItem.id,
          propertyId: property.propertyId,
          valueBoolean: property.valueBoolean,
          valueNumber: property.valueNumber,
          valueText: property.valueText
        }
      })

      if (propertyValueRows.length > 0) {
        await transaction
          .insert(itemPropertyValues)
          .values(propertyValueRows)
      }

      const [inventoryRow] = await transaction
        .insert(userEquipment)
        .values({
          itemId: createdItem.id,
          userId
        })
        .returning({
          createdAt: userEquipment.createdAt,
          id: userEquipment.id
        })

      if (inventoryRow === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to create inventory row'
        })
      }

      await transaction
        .insert(contributions)
        .values({
          action: 'submit_equipment_item',

          metadata: {
            brandId: body.brandId,
            categoryId: body.categoryId,
            name: createdItem.name,
            propertyCount: normalizedProperties.length,
            status: createdItem.status
          },

          targetId: createdItem.id,
          userId
        })

      return {
        inventory: {
          createdAt: inventoryRow.createdAt,
          id: inventoryRow.id,

          item: {
            brand: {
              name: brand.name,
              slug: brand.slug
            },

            category: {
              name: category.name,
              slug: category.slug
            },

            id: createdItem.id,
            name: createdItem.name
          }
        },

        item: {
          brand: {
            name: brand.name,
            slug: brand.slug
          },

          category: {
            name: category.name,
            slug: category.slug
          },

          createdAt: createdItem.createdAt,
          id: createdItem.id,
          name: createdItem.name,
          properties: normalizedProperties.map((property) => property.display),
          status: createdItem.status
        }
      }
    })

    setResponseStatus(event, 201)

    return response
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to submit item'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
