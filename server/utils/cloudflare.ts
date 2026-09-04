import { createError, getRequestHeader, type H3Event } from 'h3'
import * as v from 'valibot'

const photoSubmissionEnvironmentSchema = v.picklist([
  'development',
  'production',
  'staging'
])

type PhotoSubmissionEnvironment = v.InferOutput<typeof photoSubmissionEnvironmentSchema>

function getGuestClientIp(event: H3Event, isDevelopment: boolean): string {
  const cloudflareIp = getRequestHeader(event, 'cf-connecting-ip')?.trim()

  if (cloudflareIp !== undefined && cloudflareIp !== '') {
    return cloudflareIp
  }

  const localIp = isDevelopment ? event.node.req.socket.remoteAddress?.trim() : undefined

  if (localIp !== undefined && localIp !== '') {
    return localIp
  }

  throw createError({
    status: 503,
    statusMessage: 'Guest session client address unavailable'
  })
}

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

function getGuestSessionRateLimiterBinding(event: H3Event): Env['GUEST_SESSION_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.GUEST_SESSION_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusMessage: 'Guest session rate limiter unavailable'
    })
  }

  return binding
}

function getPhotoSubmissionEnvironment(event: H3Event): PhotoSubmissionEnvironment {
  const environment = event.context.cloudflare?.env.PHOTO_SUBMISSION_ENVIRONMENT

  try {
    return v.parse(photoSubmissionEnvironmentSchema, environment)
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
  getGuestClientIp,
  getGuestSessionRateLimiterBinding,
  getPhotoSubmissionEnvironment,
  getPhotoSubmissionRateLimiterBinding
}
