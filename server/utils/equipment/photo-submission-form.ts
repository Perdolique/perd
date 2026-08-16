import { createError, getRequestHeader, getRequestWebStream, type H3Event } from 'h3'

import {
  createLimitedRequestBody,
  getContentLength,
  validateDeclaredByteLength
} from '#server/utils/equipment/limited-request-body'

const maximumPhotoSubmissionBodyByteLength = 5_500_000

function validatePhotoSubmissionMultipartRequest(event: H3Event): string {
  const contentType = getRequestHeader(event, 'content-type')
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase()

  if (contentType === undefined || mediaType !== 'multipart/form-data') {
    throw createError({
      status: 415,
      statusMessage: 'Photo submission must use multipart/form-data'
    })
  }

  const hasBoundary = /;\s*boundary=(?:"[^"]+"|[^;\s]+)/iu.test(contentType)

  if (hasBoundary === false) {
    throw createError({
      status: 400,
      statusMessage: 'Multipart boundary is required'
    })
  }

  validateDeclaredByteLength(
    getContentLength(event),
    maximumPhotoSubmissionBodyByteLength
  )

  return contentType
}

async function readLimitedMultipartFormData(
  event: H3Event,
  contentType: string
): Promise<FormData> {
  const requestBody = await createLimitedRequestBody(
    getRequestWebStream(event),
    maximumPhotoSubmissionBodyByteLength
  )

  try {
    const response = new Response(requestBody.stream, {
      headers: {
        'content-type': contentType
      }
    })

    return await response.formData()
  } catch (error) {
    if (requestBody.isLimitExceeded()) {
      throw createError({
        status: 413,
        statusMessage: 'Image body is too large'
      })
    }

    throw createError({
      cause: error,
      status: 400,
      statusMessage: 'Invalid multipart form data'
    })
  } finally {
    await requestBody.close()
  }
}

export {
  readLimitedMultipartFormData,
  validatePhotoSubmissionMultipartRequest
}
