import { createError, defineEventHandler, readValidatedBody, setResponseStatus } from 'h3'
import { brands, contributions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { validateBrandMutationBody } from '#server/utils/validation/schemas'

interface BrandRecord {
  id: number;
  name: string;
  slug: string;
}

export default defineEventHandler(async (event) => {
  const { dbHttp } = event.context
  const userId = await validateAdminUser(event)
  const { name, slug } = await readValidatedBody(event, validateBrandMutationBody)

  let createdBrandRows: BrandRecord[] = []

  try {
    createdBrandRows = await dbHttp
      .insert(brands)
      .values({
        name,
        slug
      })
      .returning({
        id: brands.id,
        name: brands.name,
        slug: brands.slug
      })
  } catch {
    throw createError({
      status: 500,
      message: 'Failed to create brand'
    })
  }

  const [createdBrand] = createdBrandRows

  if (createdBrand === undefined) {
    throw createError({
      status: 500,
      message: 'Failed to create brand'
    })
  }

  await dbHttp
    .insert(contributions)
    .values({
      userId,
      action: 'create_brand',
      targetId: `${createdBrand.id}`,
      metadata: {
        name: createdBrand.name,
        slug: createdBrand.slug
      }
    })

  setResponseStatus(event, 201)

  return createdBrand
})
