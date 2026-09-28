import { createError, defineEventHandler, readValidatedBody, setResponseStatus } from 'h3'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { brandBaseSelection, type BrandBaseRecord } from '#server/utils/equipment/base-records'
import { throwBrandWriteError } from '#server/utils/equipment/brand-write-errors'
import { validateBrandMutationBody } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<BrandBaseRecord> => {
  const userId = await validateAdminUser(event)
  const { name, slug } = await readValidatedBody(event, validateBrandMutationBody)
  const dbWebsocket = createWebSocketClientFromEvent(event)

  try {
    const createdBrand = await dbWebsocket.transaction(async (transaction) => {
      const [newBrand] = await transaction
        .insert(brands)
        .values({
          name,
          slug
        })
        .returning(brandBaseSelection)

      if (newBrand === undefined) {
        throw createError({
          status: 500,
          message: 'Failed to create brand'
        })
      }

      await transaction
        .insert(contributions)
        .values({
          userId,
          action: 'create_brand',
          targetId: `${newBrand.id}`,

          metadata: {
            name: newBrand.name,
            slug: newBrand.slug
          }
        })

      return newBrand
    })

    setResponseStatus(event, 201)

    return createdBrand
  } catch (error) {
    throwBrandWriteError(error, 'create')
  } finally {
    try {
      await dbWebsocket.$client.end()
    } catch (error) {
      console.error('Failed to close brand write database client', { error })
    }
  }
})
