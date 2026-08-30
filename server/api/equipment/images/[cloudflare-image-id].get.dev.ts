import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { getCloudflareImagesBinding } from '#server/utils/cloudflare'
import { validateEquipmentImageDeliveryParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<Response> => {
  const params = await getValidatedRouterParams(
    event,
    validateEquipmentImageDeliveryParams
  )

  const cloudflareImageId = params['cloudflare-image-id']

  const image = await event.context.dbHttp.query.equipmentItemImages.findFirst({
    columns: {
      id: true
    },

    where: {
      cloudflareImageId
    }
  })

  if (image === undefined) {
    throw createError({ status: 404 })
  }

  const imagesBinding = getCloudflareImagesBinding(event)
  const missingImageError = createError({ status: 404 })
  let inspectionStream: ReadableStream<Uint8Array> | null = null
  let responseStream: ReadableStream<Uint8Array> | null = null

  try {
    const imageHandle = imagesBinding.hosted.image(cloudflareImageId)
    const imageBytes = await imageHandle.bytes()

    if (imageBytes === null) {
      throw missingImageError
    }

    const [infoStream, outputStream] = imageBytes.tee()

    inspectionStream = infoStream
    responseStream = outputStream

    const imageInfo = await imagesBinding.info(infoStream)

    return new Response(outputStream, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': imageInfo.format
      }
    })
  } catch (error) {
    await Promise.allSettled([
      inspectionStream?.cancel(),
      responseStream?.cancel()
    ])

    if (error === missingImageError) {
      throw error
    }

    console.error('Failed to load local equipment image', {
      cloudflareImageId,
      error
    })

    throw createError({
      status: 502,
      statusMessage: 'Equipment image unavailable'
    })
  }
})
