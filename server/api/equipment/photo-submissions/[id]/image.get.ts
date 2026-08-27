import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { getCloudflareImagesBinding } from '#server/utils/cloudflare'
import { validatePhotoSubmissionParams } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event): Promise<Response> => {
  await validateAdminUser(event)

  const { id } = await getValidatedRouterParams(event, validatePhotoSubmissionParams)

  const submission = await event.context.dbHttp.query.equipmentItemPhotoSubmissions.findFirst({
    columns: {
      cloudflareImageId: true
    },

    where: {
      id,
      status: 'pending'
    }
  })

  if (submission === undefined) {
    throw createError({ status: 404 })
  }

  const imagesBinding = getCloudflareImagesBinding(event)
  const missingImageError = createError({ status: 404 })
  let inspectionStream: ReadableStream<Uint8Array> | null = null
  let responseStream: ReadableStream<Uint8Array> | null = null

  try {
    const imageHandle = imagesBinding.hosted.image(submission.cloudflareImageId)
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

    console.error('Failed to load private equipment photo submission image', {
      error,
      submissionId: id
    })

    throw createError({
      status: 502,
      statusMessage: 'Photo preview unavailable'
    })
  }
})
