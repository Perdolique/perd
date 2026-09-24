import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import authenticationOptionsHandler from '#server/api/auth/passkeys/options.post'
import authenticationVerifyHandler from '#server/api/auth/passkeys/verify.post'
import registrationOptionsHandler from '#server/api/account/passkeys/registration/options.post'
import registrationVerifyHandler from '#server/api/account/passkeys/registration/verify.post'
import { useAppSession } from '#server/utils/session'
import { getSessionUser, type SessionUser } from '#server/utils/user'

const { useRuntimeConfigMock } = vi.hoisted(() => {
  return { useRuntimeConfigMock: vi.fn() }
})

vi.mock(import('nitropack/runtime'), () => {
  return { useRuntimeConfig: useRuntimeConfigMock }
})

vi.mock(import('#server/utils/user'), () => {
  return { getSessionUser: vi.fn() }
})

vi.mock(import('#server/utils/session'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    useAppSession: vi.fn()
  }
})

const origin = 'https://metsik.app'
const spoofedForwardedIp = '198.51.100.240'
const firstIp = '203.0.113.10'
const secondIp = '203.0.113.11'
const firstUserId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const secondUserId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'
const rateLimitMock = vi.fn<Env['PASSKEY_RATE_LIMITER']['limit']>()

const anonymous = {
  userId: null,
  email: null,
  isAdmin: false,
  isGuest: true,
  isTwitchLinked: false
} satisfies SessionUser

function account(userId: string): SessionUser {
  return {
    ...anonymous,
    userId,
    email: `${userId}@example.com`,
    isGuest: false
  }
}

function createPasskeyEvent(clientIp: string, body = '{}') {
  const request = new IncomingMessage(new Socket())

  request.method = 'POST'
  request.headers.origin = origin
  request.headers['content-type'] = 'application/json'
  request.headers['cf-connecting-ip'] = clientIp
  request.headers['x-forwarded-for'] = spoofedForwardedIp

  request.push(new TextEncoder().encode(body))

  // oxlint-disable-next-line unicorn/prefer-single-call -- Readable.push ends the stream with null.
  request.push(null)

  const event = createEvent(request, new ServerResponse(request))

  Object.assign(event.context, {
    cloudflare: {
      env: {
        PASSKEY_RATE_LIMITER: { limit: rateLimitMock }
      }
    },

    dbHttp: {}
  })

  return event
}

describe('passkey handler rate limits', () => {
  beforeEach(() => {
    useRuntimeConfigMock.mockReturnValue({
      passkeys: {
        origin,
        rpId: 'metsik.app'
      }
    })

    vi.mocked(getSessionUser).mockResolvedValue(anonymous)

    vi.mocked(useAppSession).mockResolvedValue({
      id: 'browser-session',
      data: { sessionVersion: 4 },
      update: vi.fn(),
      clear: vi.fn()
    })

    rateLimitMock.mockResolvedValue({ success: false })

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected rate-limit failures are asserted below.
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it.each([
    {
      actor: anonymous,
      body: '{}',
      expectedKey: `authentication:options:ip:${firstIp}`,
      handler: authenticationOptionsHandler,
      scenario: 'authentication options'
    },
    {
      actor: anonymous,
      body: '{}',
      expectedKey: `authentication:verify:ip:${firstIp}`,
      handler: authenticationVerifyHandler,
      scenario: 'authentication verification'
    },
    {
      actor: account(firstUserId),
      body: '{"name":"Laptop"}',
      expectedKey: `registration:options:user:${firstUserId}`,
      handler: registrationOptionsHandler,
      scenario: 'registration options'
    },
    {
      actor: account(firstUserId),
      body: '{}',
      expectedKey: `registration:verify:user:${firstUserId}`,
      handler: registrationVerifyHandler,
      scenario: 'registration verification'
    }
  ])('uses the actual phase and actor key for $scenario', async ({ actor, body, expectedKey, handler }) => {
    vi.mocked(getSessionUser).mockResolvedValue(actor)

    const event = createPasskeyEvent(firstIp, body)

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 429 })
    expect(rateLimitMock).toHaveBeenCalledExactlyOnceWith({ key: expectedKey })
  })

  it('isolates authentication verification quota by trusted client IP', async () => {
    const exhaustedKey = `authentication:verify:ip:${firstIp}`
    const availableKey = `authentication:verify:ip:${secondIp}`

    // oxlint-disable-next-line typescript/require-await -- The binding mock resolves a quota decision without I/O.
    rateLimitMock.mockImplementation(async ({ key }) => {
      return { success: key !== exhaustedKey }
    })

    await expect(authenticationVerifyHandler(createPasskeyEvent(firstIp))).rejects.toMatchObject({
      statusCode: 429
    })

    await expect(authenticationVerifyHandler(createPasskeyEvent(secondIp))).rejects.toMatchObject({
      statusCode: 401
    })

    expect(rateLimitMock.mock.calls).toStrictEqual([
      [{ key: exhaustedKey }],
      [{ key: availableKey }]
    ])
  })

  it('isolates registration verification quota by account', async () => {
    const exhaustedKey = `registration:verify:user:${firstUserId}`
    const availableKey = `registration:verify:user:${secondUserId}`

    vi.mocked(getSessionUser)
      .mockResolvedValueOnce(account(firstUserId))
      .mockResolvedValueOnce(account(secondUserId))

    // oxlint-disable-next-line typescript/require-await -- The binding mock resolves a quota decision without I/O.
    rateLimitMock.mockImplementation(async ({ key }) => {
      return { success: key !== exhaustedKey }
    })

    await expect(registrationVerifyHandler(createPasskeyEvent(firstIp))).rejects.toMatchObject({
      statusCode: 429
    })

    await expect(registrationVerifyHandler(createPasskeyEvent(firstIp))).rejects.toMatchObject({
      statusCode: 400
    })

    expect(rateLimitMock.mock.calls).toStrictEqual([
      [{ key: exhaustedKey }],
      [{ key: availableKey }]
    ])
  })
})
