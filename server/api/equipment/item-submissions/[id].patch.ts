import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody } from 'h3'

import {
  brands,
  contributions,
  equipmentCategories,
  equipmentItems
} from '#server/database/schema'

import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  validateItemDetailParams,
  validateItemSubmissionModerationBody
} from '#server/utils/validation/schemas'

interface CatalogEntitySummary {
  name: string;
  slug: string;
}

interface ItemSubmissionSummary {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  createdAt: Date | string;
  createdBy: string | null;
  id: string;
  name: string;
  status: string;
}

export default defineEventHandler(async (event) : Promise<ItemSubmissionSummary> => {
  const userId = await validateAdminUser(event)
  const { id } = await getValidatedRouterParams(event, validateItemDetailParams)
  const { status } = await readValidatedBody(event, validateItemSubmissionModerationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const [currentItem] = await transaction
        .select({
          brandName: brands.name,
          brandSlug: brands.slug,
          categoryName: equipmentCategories.name,
          categorySlug: equipmentCategories.slug,
          createdAt: equipmentItems.createdAt,
          createdBy: equipmentItems.createdBy,
          id: equipmentItems.id,
          name: equipmentItems.name,
          status: equipmentItems.status
        })
        .from(equipmentItems)
        .innerJoin(brands, eq(equipmentItems.brandId, brands.id))
        .innerJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
        .where(
          eq(equipmentItems.id, id)
        )
        .limit(1)

      if (currentItem === undefined) {
        throw createError({ status: 404 })
      }

      if (currentItem.status !== 'pending') {
        throw createError({
          status: 409,
          message: 'Only pending item submissions can be moderated'
        })
      }

      const [updatedItem] = await transaction
        .update(equipmentItems)
        .set({
          status
        })
        .where(
          and(
            eq(equipmentItems.id, id),
            eq(equipmentItems.status, 'pending')
          )
        )
        .returning({
          status: equipmentItems.status
        })

      if (updatedItem === undefined) {
        throw createError({
          status: 409,
          message: 'Only pending item submissions can be moderated'
        })
      }

      const action = status === 'approved'
        ? 'approve_equipment_item'
        : 'reject_equipment_item'

      await transaction
        .insert(contributions)
        .values({
          action,

          metadata: {
            previousStatus: currentItem.status,
            status: updatedItem.status
          },

          targetId: currentItem.id,
          userId
        })

      return {
        brand: {
          name: currentItem.brandName,
          slug: currentItem.brandSlug
        },

        category: {
          name: currentItem.categoryName,
          slug: currentItem.categorySlug
        },

        createdAt: currentItem.createdAt,
        createdBy: currentItem.createdBy,
        id: currentItem.id,
        name: currentItem.name,
        status: updatedItem.status
      }
    })
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to moderate item submission'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
