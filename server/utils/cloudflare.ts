import { createError, type H3Event } from 'h3'

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

export {
  getCloudflareImagesBinding,
  getPhotoSubmissionRateLimiterBinding
}
