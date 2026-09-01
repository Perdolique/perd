import { H3Error } from 'h3'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { getPhotoSubmissionEnvironment } from '#server/utils/cloudflare'
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
