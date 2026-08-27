import {
  createError,
  defineEventHandler,
  getRequestHeader,
  getValidatedRouterParams,
  setResponseHeader,
  setResponseStatus,
  type H3Event
} from 'h3'

import { getCloudflareImagesBinding, getPhotoSubmissionRateLimiterBinding } from '#server/utils/cloudflare'
import { createEquipmentItemImageBody, uploadHostedEquipmentImage } from '#server/utils/equipment/item-images'

import {
  findPersistedPhotoSubmission,
  persistUploadedPhotoSubmission
} from '#server/utils/equipment/photo-submission-persistence'

import {
  maximumPendingPhotoSubmissionCount,
  validatePhotoSubmissionIdempotencyItem,
  type PersistedPhotoSubmission
} from '#server/utils/equipment/photo-submission-record'

import {
  readLimitedMultipartFormData,
  validatePhotoSubmissionMultipartRequest
} from '#server/utils/equipment/photo-submission-form'

import { validateRegisteredUser } from '#server/utils/user'

import {
  validateItemDetailParams,
  validatePhotoSubmissionCreateBody,
  validatePhotoSubmissionIdempotencyKey
} from '#server/utils/validation/schemas'

interface PhotoSubmissionCreateResponse {
  id: string;
  status: 'approved' | 'pending' | 'rejected';
}

function getStringFormDataValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name)

  return typeof value === 'string' ? value : undefined
}

function readIdempotencyKey(event: H3Event): string {
  try {
    return validatePhotoSubmissionIdempotencyKey(
      getRequestHeader(event, 'idempotency-key')
    )
  } catch (error) {
    throw createError({
      cause: error,
      status: 400,
      statusMessage: 'Valid Idempotency-Key header is required'
    })
  }
}

async function validatePhotoSubmissionPreconditions(
  event: H3Event,
  userId: string,
  itemId: string
): Promise<void> {
  const itemPromise = event.context.dbHttp.query.equipmentItems.findFirst({
    columns: { id: true },

    where: {
      id: itemId,
      status: 'approved'
    }
  })

  const pendingSubmissionsPromise = event.context.dbHttp.query.equipmentItemPhotoSubmissions.findMany({
    columns: { id: true },

    where: {
      createdBy: userId,
      itemId,
      status: 'pending'
    },

    limit: maximumPendingPhotoSubmissionCount
  })

  const [item, pendingSubmissions] = await Promise.all([
    itemPromise,
    pendingSubmissionsPromise
  ])

  if (item === undefined) {
    throw createError({
      status: 404,
      statusMessage: 'Equipment item not found'
    })
  }

  if (pendingSubmissions.length >= maximumPendingPhotoSubmissionCount) {
    throw createError({
      status: 409,
      statusMessage: 'Three photos are already awaiting review for this item'
    })
  }
}

async function getPhotoSubmissionRateLimitOutcome(
  event: H3Event,
  userId: string
): Promise<RateLimitOutcome> {
  try {
    return await getPhotoSubmissionRateLimiterBinding(event).limit({ key: userId })
  } catch (error) {
    console.error('Failed to apply photo submission rate limit', {
      error,
      userId
    })

    throw createError({
      status: 503,
      statusMessage: 'Photo submission is temporarily unavailable'
    })
  }
}

async function enforcePhotoSubmissionRateLimit(event: H3Event, userId: string): Promise<void> {
  const outcome = await getPhotoSubmissionRateLimitOutcome(event, userId)

  if (outcome.success === false) {
    setResponseHeader(event, 'retry-after', 60)

    throw createError({
      status: 429,
      statusMessage: 'Too many photo submission attempts'
    })
  }
}

function sendCreatedResponse(
  event: H3Event,
  submission: PersistedPhotoSubmission
): PhotoSubmissionCreateResponse {
  setResponseStatus(event, 201)

  return {
    id: submission.id,
    status: submission.status
  }
}

export default defineEventHandler(async (event): Promise<PhotoSubmissionCreateResponse> => {
  const userId = await validateRegisteredUser(event)
  const { id: itemId } = await getValidatedRouterParams(event, validateItemDetailParams)
  const idempotencyKey = readIdempotencyKey(event)
  const persistedSubmission = await findPersistedPhotoSubmission(event, userId, idempotencyKey)

  if (persistedSubmission !== null) {
    validatePhotoSubmissionIdempotencyItem(persistedSubmission, itemId)

    return sendCreatedResponse(event, persistedSubmission)
  }

  await validatePhotoSubmissionPreconditions(event, userId, itemId)
  await enforcePhotoSubmissionRateLimit(event, userId)

  const contentType = validatePhotoSubmissionMultipartRequest(event)
  const formData = await readLimitedMultipartFormData(event, contentType)
  const photo = formData.get('photo')

  if ((photo instanceof globalThis.File) === false) {
    throw createError({
      status: 400,
      statusMessage: 'Photo file is required'
    })
  }

  const { filename, sourceType, sourceUrl } = validatePhotoSubmissionCreateBody({
    filename: photo.name,
    rightsConfirmed: getStringFormDataValue(formData, 'rightsConfirmed'),
    sourceType: getStringFormDataValue(formData, 'sourceType'),
    sourceUrl: getStringFormDataValue(formData, 'sourceUrl')
  })

  const imagesBinding = getCloudflareImagesBinding(event)

  const imageBody = await createEquipmentItemImageBody({
    declaredByteLength: photo.size,
    mediaType: photo.type,
    stream: photo.stream()
  })

  const cloudflareImageId = await uploadHostedEquipmentImage({
    binding: imagesBinding,
    body: imageBody,
    creator: userId,
    filename,

    metadata: {
      itemId,
      kind: 'equipment-photo-submission'
    },

    requireSignedURLs: true
  })

  const submission = await persistUploadedPhotoSubmission({
    binding: imagesBinding,
    cloudflareImageId,
    event,
    filename,
    idempotencyKey,
    itemId,
    sourceType,
    sourceUrl,
    userId
  })

  return sendCreatedResponse(event, submission)
})

export type {
  PhotoSubmissionCreateResponse
}
