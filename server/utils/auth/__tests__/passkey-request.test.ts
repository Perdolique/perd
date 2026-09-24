import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createError, createEvent } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSessionUser } from '#server/utils/user'
import { useAppSession } from '#server/utils/session'

import {
  getPasskeyActor,
  handlePasskeyRequest,
  enforcePasskeyRateLimit,
  validatePasskeyOrigin,
  validatePasskeyRequest,
  PasskeyVerificationError
} from '../passkey-request'

import { readLimitedValidatedJsonBody } from '../email-authentication-request'
import { validatePasskeyName } from '#server/utils/validation/schemas'

vi.mock(import('nitropack/runtime'), () => {
  return { useRuntimeConfig: vi.fn() }
})

vi.mock(import('#server/utils/user'), () => {
  return { getSessionUser: vi.fn() }
})

vi.mock(import('#server/utils/session'), () => {
  return { useAppSession: vi.fn() }
})

const anonymous = {
  userId: null,
  email: null,
  isAdmin: false,
  isGuest: true,
  isTwitchLinked: false
}

const account = {
  ...anonymous,
  userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477dd'
}

const config = {
  origin: 'https://metsik.app',
  rpId: 'metsik.app'
}

function eventWithBody(body = '{}') {
  const request = new IncomingMessage(new Socket())

  request.method = 'POST'
  request.headers.origin = config.origin
  request.headers['content-type'] = 'application/json'

  request.push(new TextEncoder().encode(body))

  // oxlint-disable-next-line unicorn/prefer-single-call -- Readable.push ends the stream with null.
  request.push(null)

  return createEvent(request, new ServerResponse(request))
}

describe('passkey request protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected failures are asserted below.
    })

    vi.mocked(getSessionUser).mockResolvedValue(anonymous)

    vi.mocked(useAppSession).mockResolvedValue({
      id: 'browser',
      data: { sessionVersion: 4 },
      update: vi.fn(),
      clear: vi.fn()
    })
  })

  it.each(['https://metsik.app', 'https://staging.metsik.app', 'http://localhost:3000', 'http://localhost:8888'])('accepts configured origin %s', (origin) => {
    expect(validatePasskeyOrigin(origin)).toStrictEqual({
      origin,
      rpId: new URL(origin).hostname
    })
  })

  it.each(['', 'https://metsik.app/', 'http://metsik.app', 'https://metsik.app/login', 'null'])('rejects an invalid origin %s', (origin) => {
    expect(() => validatePasskeyOrigin(origin)).toThrow('Passkeys are temporarily unavailable')
  })

  it('requires exact origin and JSON and never trusts forwarded host', () => {
    const event = eventWithBody()

    event.node.req.headers.origin = 'https://evil.example'
    event.node.req.headers['x-forwarded-host'] = 'metsik.app'

    expect(() => { validatePasskeyRequest(event, config) }).toThrow('Request origin is not allowed')

    event.node.req.headers.origin = config.origin
    event.node.req.headers['content-type'] = 'text/plain'

    expect(() => { validatePasskeyRequest(event, config) }).toThrow('JSON is required')
  })

  it('requires a durable account for enrollment but permits current-session management', async () => {
    const event = eventWithBody()

    await expect(getPasskeyActor(event, 'management')).rejects.toMatchObject({ statusCode: 401 })
    vi.mocked(getSessionUser).mockResolvedValue(account)
    await expect(getPasskeyActor(event, 'registration')).rejects.toMatchObject({ statusCode: 403 })

    await expect(getPasskeyActor(event, 'management')).resolves.toMatchObject({ actor: {
      userId: account.userId,
      sessionVersion: 4
    } })

    await expect(getPasskeyActor(event, 'authentication')).rejects.toMatchObject({ statusCode: 409 })

    vi.mocked(getSessionUser).mockResolvedValue({
      ...account,
      isTwitchLinked: true
    })

    await expect(getPasskeyActor(event, 'registration')).resolves.toMatchObject({ user: { isTwitchLinked: true } })

    vi.mocked(getSessionUser).mockResolvedValue({
      ...account,
      email: 'verified@example.com'
    })

    await expect(getPasskeyActor(event, 'registration')).resolves.toMatchObject({ user: { email: 'verified@example.com' } })
  })

  it('fails closed for missing rate bindings and gives 429 on denial', async () => {
    const event = eventWithBody()

    await expect(enforcePasskeyRateLimit(event, 'authentication:options:ip:127.0.0.1')).rejects.toMatchObject({ statusCode: 503 })

    const limit = vi.fn().mockResolvedValue({ success: false })

    Object.assign(event.context, { cloudflare: { env: { PASSKEY_RATE_LIMITER: { limit } } } })
    await expect(enforcePasskeyRateLimit(event, 'registration:verify:user:owner')).rejects.toMatchObject({ statusCode: 429 })
    expect(limit).toHaveBeenCalledWith({ key: 'registration:verify:user:owner' })
    expect(event.node.res.getHeader('Retry-After')).toBe(60)
  })

  it('returns one safe authentication error and marks errors as non-cacheable', async () => {
    const event = eventWithBody()

    await expect(handlePasskeyRequest(event, 'authentication', () => {
      throw new PasskeyVerificationError('Unknown credential private-id')
    })).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Could not verify the passkey. Try again.'
    })

    await expect(handlePasskeyRequest(event, 'authentication', () => {
      throw createError({
        status: 400,
        message: 'Wrong challenge'
      })
    })).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Could not verify the passkey. Try again.'
    })

    expect(event.node.res.getHeader('Cache-Control')).toBe('no-store')
  })

  it('bounds JSON, trims names, and removes malformed JSON payloads from telemetry', async () => {
    const valid = eventWithBody('{"name":"  Laptop  "}')

    await expect(readLimitedValidatedJsonBody(valid, 1024, validatePasskeyName)).resolves.toStrictEqual({ name: 'Laptop' })

    const oversized = eventWithBody('x'.repeat(65_537))

    await expect(readLimitedValidatedJsonBody(oversized, 65_536, validatePasskeyName)).rejects.toMatchObject({ statusCode: 413 })

    const invalid = eventWithBody('secret-authenticator-payload')

    await expect(handlePasskeyRequest(invalid, 'registration', async () => readLimitedValidatedJsonBody(invalid, 65_536, validatePasskeyName))).rejects.toMatchObject({ statusCode: 400 })

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(logged).toContain('SyntaxError')
    expect(logged).not.toContain('secret-authenticator-payload')
  })

  it.each([
    ['one character', 'a', 'a'],
    ['64 characters', ` ${'a'.repeat(64)} `, 'a'.repeat(64)]
  ])('accepts a passkey name with %s after trimming', async (_scenario, name, expectedName) => {
    const event = eventWithBody(JSON.stringify({ name }))

    await expect(readLimitedValidatedJsonBody(event, 1024, validatePasskeyName)).resolves.toStrictEqual({
      name: expectedName
    })
  })

  it.each([
    ['only whitespace', '   '],
    ['65 characters', 'a'.repeat(65)]
  ])('rejects a passkey name with %s', async (_scenario, name) => {
    const event = eventWithBody(JSON.stringify({ name }))

    await expect(readLimitedValidatedJsonBody(event, 1024, validatePasskeyName)).rejects.toMatchObject({
      statusCode: 400
    })
  })
})
