import { createError, type H3Event } from 'h3'

import {
  parsePhotoSubmissionEnvironment,
  type PhotoSubmissionEnvironment
} from '#server/utils/equipment/photo-submission-image-metadata'

function getCloudflareImagesBinding(event: H3Event) : Env['IMAGES'] {
  const binding = event.context.cloudflare?.env.IMAGES

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusMessage: 'Images binding unavailable'
    })
  }

  return binding
}

function getPhotoSubmissionRateLimiterBinding(event: H3Event): Env['PHOTO_SUBMISSION_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.PHOTO_SUBMISSION_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusMessage: 'Photo submission rate limiter unavailable'
    })
  }

  return binding
}

function getPhotoSubmissionEnvironment(event: H3Event): PhotoSubmissionEnvironment {
  const environment = event.context.cloudflare?.env.PHOTO_SUBMISSION_ENVIRONMENT

  try {
    return parsePhotoSubmissionEnvironment(environment)
  } catch (error) {
    throw createError({
      cause: error,
      status: 503,
      statusMessage: 'Photo submission environment unavailable'
    })
  }
}

export {
  getCloudflareImagesBinding,
  getPhotoSubmissionEnvironment,
  getPhotoSubmissionRateLimiterBinding
}
