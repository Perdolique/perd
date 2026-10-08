import type { InferInput } from 'valibot'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { brandBaseSelection, type BrandBaseRecord } from '#server/utils/equipment/base-records'
import { throwBrandWriteError } from '#server/utils/equipment/brand-write-errors'

import {
  validateBrandIdParams,
  validateBrandMutationBody,
  type brandMutationSchema
} from '#server/utils/validation/schemas'

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof brandMutationSchema>; }>): Promise<BrandBaseRecord> => {
  const userId = await validateAdminUser(event)
  const { id: brandId } = await getValidatedRouteParams(event, validateBrandIdParams)
  const { name, slug } = await readValidatedBody(event, validateBrandMutationBody)
  const dbWebsocket = createRuntimeWebSocketClient()

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
    throwBrandWriteError(error, 'update')
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      console.error('Failed to close brand write database client', { error })
    }
  }
})
