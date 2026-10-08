import { getRequestMetadataHeader, getDevelopmentClientIP } from '#server/utils/request-runtime'
import { createError, type RequestEvent } from 'nuxt/server'
import * as v from 'valibot'

const photoSubmissionEnvironmentSchema = v.picklist([
  'development',
  'production',
  'staging'
])

type PhotoSubmissionEnvironment = v.InferOutput<typeof photoSubmissionEnvironmentSchema>

function getTrustedClientIp(event: RequestEvent, isDevelopment: boolean): string {
  const cloudflareIp = getRequestMetadataHeader(event, 'cf-connecting-ip')?.trim()

  if (cloudflareIp !== undefined && cloudflareIp !== '') {
    return cloudflareIp
  }

  const localIp = isDevelopment ? getDevelopmentClientIP(event)?.trim() : undefined

  if (localIp !== undefined && localIp !== '') {
    return localIp
  }

  throw createError({
    status: 503,
    statusText: 'Client address unavailable'
  })
}

function getCloudflareImagesBinding(event: RequestEvent) : Env['IMAGES'] {
  const binding = event.context.cloudflare?.env.IMAGES

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Images binding unavailable'
    })
  }

  return binding
}

function getPhotoSubmissionRateLimiterBinding(event: RequestEvent): Env['PHOTO_SUBMISSION_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.PHOTO_SUBMISSION_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Photo submission rate limiter unavailable'
    })
  }

  return binding
}

function getPhotoSubmissionTurnstileRateLimiterBinding(
  event: RequestEvent
): Env['PHOTO_SUBMISSION_TURNSTILE_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.PHOTO_SUBMISSION_TURNSTILE_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Photo submission security rate limiter unavailable'
    })
  }

  return binding
}

function getItemSubmissionRateLimiterBinding(event: RequestEvent): Env['ITEM_SUBMISSION_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.ITEM_SUBMISSION_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Item submission rate limiter unavailable'
    })
  }

  return binding
}

function getGuestSessionRateLimiterBinding(event: RequestEvent): Env['GUEST_SESSION_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.GUEST_SESSION_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Guest session rate limiter unavailable'
    })
  }

  return binding
}

function getEmailSignInRateLimiterBinding(event: RequestEvent): Env['EMAIL_SIGN_IN_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.EMAIL_SIGN_IN_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Email sign-in rate limiter unavailable'
    })
  }

  return binding
}

function getPasswordRecoveryRateLimiterBinding(event: RequestEvent): Env['PASSWORD_RECOVERY_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.PASSWORD_RECOVERY_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Password recovery rate limiter unavailable'
    })
  }

  return binding
}

function getTwitchOAuthRateLimiterBinding(event: RequestEvent): Env['TWITCH_OAUTH_RATE_LIMITER'] {
  const binding = event.context.cloudflare?.env.TWITCH_OAUTH_RATE_LIMITER

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Twitch OAuth rate limiter unavailable'
    })
  }

  return binding
}

function getEmailBinding(event: RequestEvent): Env['EMAIL'] {
  const binding = event.context.cloudflare?.env.EMAIL

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusText: 'Email delivery is temporarily unavailable'
    })
  }

  return binding
}

function getPhotoSubmissionEnvironment(event: RequestEvent): PhotoSubmissionEnvironment {
  const environment = event.context.cloudflare?.env.PHOTO_SUBMISSION_ENVIRONMENT

  try {
    return v.parse(photoSubmissionEnvironmentSchema, environment)
  } catch (error) {
    throw createError({
      cause: error,
      status: 503,
      statusText: 'Photo submission environment unavailable'
    })
  }
}

export {
  getCloudflareImagesBinding,
  getEmailBinding,
  getEmailSignInRateLimiterBinding,
  getTrustedClientIp,
  getGuestSessionRateLimiterBinding,
  getItemSubmissionRateLimiterBinding,
  getPhotoSubmissionEnvironment,
  getPhotoSubmissionRateLimiterBinding,
  getPhotoSubmissionTurnstileRateLimiterBinding,
  getPasswordRecoveryRateLimiterBinding,
  getTwitchOAuthRateLimiterBinding
}
