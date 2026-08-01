import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { getCloudflareImagesBinding } from '#server/utils/cloudflare'
import { validateItemImageParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) : Promise<Response> => {
  await validateAdminUser(event)

  const {
    id: itemId,
    'image-id': imageId
  } = await getValidatedRouterParams(event, validateItemImageParams)

  const image = await event.context.dbHttp.query.equipmentItemImages.findFirst({
    columns: {
      cloudflareImageId: true
    },

    where: {
      id: imageId,
      itemId
    }
  })

  if (image === undefined) {
    throw createError({
      status: 404,
      statusMessage: 'Equipment image not found'
    })
  }

  const imagesBinding = getCloudflareImagesBinding(event)
  const imageHandle = imagesBinding.hosted.image(image.cloudflareImageId)
  const bytes = await imageHandle.bytes()

  if (bytes === null) {
    throw createError({
      status: 404,
      statusMessage: 'Equipment image not found'
    })
  }

  return new Response(bytes)
})
