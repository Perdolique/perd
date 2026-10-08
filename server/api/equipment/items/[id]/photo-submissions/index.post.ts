import { getRequestMetadataHeader } from '#server/utils/request-runtime'
import { createError, defineEventHandler, setResponseStatus, type RequestEvent } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'

import {
  getCloudflareImagesBinding,
  getPhotoSubmissionEnvironment,
  getPhotoSubmissionRateLimiterBinding,
  getPhotoSubmissionTurnstileRateLimiterBinding,
  getTrustedClientIp
} from '#server/utils/cloudflare'

import { photoSubmissionTurnstileAction, turnstileTokenHeaderName } from '#shared/utils/turnstile'
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
import { verifyTurnstile } from '#server/utils/turnstile'

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

function readIdempotencyKey(event: RequestEvent): string {
  try {
    return validatePhotoSubmissionIdempotencyKey(
      getRequestMetadataHeader(event, 'idempotency-key')
    )
  } catch (error) {
    throw createError({
      cause: error,
      status: 400,
      statusText: 'Valid Idempotency-Key header is required'
    })
  }
}

async function validatePhotoSubmissionPreconditions(
  event: RequestEvent,
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
      statusText: 'Equipment item not found'
    })
  }

  if (pendingSubmissions.length >= maximumPendingPhotoSubmissionCount) {
    throw createError({
      status: 409,
      statusText: 'Three photos are already awaiting review for this item'
    })
  }
}

async function getPhotoSubmissionRateLimitOutcome(
  event: RequestEvent,
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
      statusText: 'Photo submission is temporarily unavailable'
    })
  }
}

async function enforcePhotoSubmissionRateLimit(event: RequestEvent, userId: string): Promise<void> {
  const outcome = await getPhotoSubmissionRateLimitOutcome(event, userId)

  if (outcome.success === false) {
    event.res.headers.set('retry-after', '60')

    throw createError({
      status: 429,
      statusText: 'Too many photo submission attempts'
    })
  }
}

async function getPhotoSubmissionTurnstileRateLimitOutcomes(
  event: RequestEvent,
  userId: string,
  clientIp: string
): Promise<readonly [RateLimitOutcome, RateLimitOutcome]> {
  try {
    const limiter = getPhotoSubmissionTurnstileRateLimiterBinding(event)
    const userOutcome = await limiter.limit({ key: `user:${userId}` })
    const ipOutcome = await limiter.limit({ key: `ip:${clientIp}` })

    return [userOutcome, ipOutcome]
  } catch (error) {
    console.error('Failed to apply photo submission security rate limit', {
      error,
      userId
    })

    throw createError({
      status: 503,
      statusText: 'Photo submission is temporarily unavailable'
    })
  }
}

async function enforcePhotoSubmissionTurnstileRateLimit(
  event: RequestEvent,
  userId: string,
  clientIp: string
): Promise<void> {
  const outcomes = await getPhotoSubmissionTurnstileRateLimitOutcomes(event, userId, clientIp)

  if (outcomes.some(({ success }) => success === false)) {
    event.res.headers.set('retry-after', '60')

    throw createError({
      status: 429,
      statusText: 'Too many photo submission attempts'
    })
  }
}

function sendCreatedResponse(
  event: RequestEvent,
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
  const { id: itemId } = await getValidatedRouteParams(event, validateItemDetailParams)
  const idempotencyKey = readIdempotencyKey(event)
  const turnstileToken = getRequestMetadataHeader(event, turnstileTokenHeaderName)
  const clientIp = getTrustedClientIp(event, import.meta.dev === true)

  await enforcePhotoSubmissionTurnstileRateLimit(event, userId, clientIp)

  await verifyTurnstile(turnstileToken, {
    remoteIp: clientIp,
    expectedAction: photoSubmissionTurnstileAction
  })

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
      statusText: 'Photo file is required'
    })
  }

  const { filename, sourceType, sourceUrl } = validatePhotoSubmissionCreateBody({
    filename: photo.name,
    rightsConfirmed: getStringFormDataValue(formData, 'rightsConfirmed'),
    sourceType: getStringFormDataValue(formData, 'sourceType'),
    sourceUrl: getStringFormDataValue(formData, 'sourceUrl')
  })

  const imagesBinding = getCloudflareImagesBinding(event)
  const photoSubmissionEnvironment = getPhotoSubmissionEnvironment(event)

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
      environment: photoSubmissionEnvironment,
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
