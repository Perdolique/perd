import { H3Error } from 'h3'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

import {
  getGuestClientIp,
  getGuestSessionRateLimiterBinding,
  getPhotoSubmissionEnvironment
} from '#server/utils/cloudflare'

import { createTestEvent } from '~~/test-utils/create-test-event'

function createEnvironmentEvent(environment: unknown) {
  const event = createTestEvent({})

  Object.assign(event.context, {
    cloudflare: {
      env: {
        PHOTO_SUBMISSION_ENVIRONMENT: environment
      }
    }
  })

  return event
}

function getEnvironmentError(environment?: unknown): H3Error {
  const event = environment === undefined
    ? createTestEvent({})
    : createEnvironmentEvent(environment)

  try {
    getPhotoSubmissionEnvironment(event)
  } catch (error) {
    if (error instanceof H3Error) {
      return error
    }

    throw error
  }

  throw new Error('Expected environment validation to fail')
}

describe(getPhotoSubmissionEnvironment, () => {
  it.each([
    'development',
    'production',
    'staging'
  ] as const)('should accept %s', (environment) => {
    const event = createEnvironmentEvent(environment)

    expect(getPhotoSubmissionEnvironment(event)).toBe(environment)
  })

  it.each([
    {
      environment: undefined,
      state: 'missing'
    },
    {
      environment: 'preview',
      state: 'invalid'
    }
  ])('should fail closed when the binding is $state', ({ environment }) => {
    const error = getEnvironmentError(environment)

    expect(error.statusCode).toBe(503)
    expect(error.statusMessage).toBe('Photo submission environment unavailable')
    expect(error.cause).toBeInstanceOf(v.ValiError)
  })
})

describe(getGuestSessionRateLimiterBinding, () => {
  it('should return the configured binding', () => {
    const binding = {
      limit() {
        throw new Error('The getter must not call the binding')
      }
    }

    const event = createTestEvent({})

    Object.assign(event.context, {
      cloudflare: {
        env: {
          GUEST_SESSION_RATE_LIMITER: binding
        }
      }
    })

    expect(getGuestSessionRateLimiterBinding(event)).toBe(binding)
  })

  it('should fail closed when the binding is unavailable', () => {
    const event = createTestEvent({})

    expect(() => getGuestSessionRateLimiterBinding(event)).toThrow(
      expect.objectContaining({
        statusCode: 503,
        statusMessage: 'Guest session rate limiter unavailable'
      })
    )
  })
})

describe(getGuestClientIp, () => {
  it('should use the trusted Cloudflare client IP', () => {
    const event = createTestEvent({})

    event.node.req.headers['cf-connecting-ip'] = ' 203.0.113.20 '

    expect(getGuestClientIp(event, false)).toBe('203.0.113.20')
  })

  it('should use the socket IP only during local development', () => {
    const event = createTestEvent({})

    Object.defineProperty(event.node.req.socket, 'remoteAddress', {
      configurable: true,
      value: '127.0.0.1'
    })

    expect(getGuestClientIp(event, true)).toBe('127.0.0.1')

    expect(() => getGuestClientIp(event, false)).toThrow(
      expect.objectContaining({ statusCode: 503 })
    )
  })

  it('should fail closed when no client IP is available', () => {
    const event = createTestEvent({})

    expect(() => getGuestClientIp(event, true)).toThrow(
      expect.objectContaining({
        statusCode: 503,
        statusMessage: 'Guest session client address unavailable'
      })
    )
  })
})
