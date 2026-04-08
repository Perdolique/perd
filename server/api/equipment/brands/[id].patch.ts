import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody } from 'h3'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { brandBaseSelection } from '#server/utils/equipment/base-records'

import {
  validateBrandIdParams,
  validateBrandMutationBody
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  const userId = await validateAdminUser(event)
  const { id: brandId } = await getValidatedRouterParams(event, validateBrandIdParams)
  const { name, slug } = await readValidatedBody(event, validateBrandMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    return await dbWebsocket.transaction(async (transaction) => {
      const [updatedBrand] = await transaction
        .update(brands)
        .set({
          name,
          slug
        })
        .where(
          eq(brandBaseSelection.id, brandId)
        )
        .returning(brandBaseSelection)

      if (updatedBrand === undefined) {
        throw createError({ status: 404 })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'update_brand',
          targetId: `${updatedBrand.id}`,

          metadata: {
            name: updatedBrand.name,
            slug: updatedBrand.slug
          }
        })

      return updatedBrand
    })
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Failed to update brand'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})
