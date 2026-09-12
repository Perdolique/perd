import { DrizzleQueryError } from 'drizzle-orm'
import { createError, type H3Event, type ValidateFunction } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CloudflareModule from '#server/utils/cloudflare'
import emailSignInHandler from '#server/api/auth/email/sign-in.post'
import { emailCredentials, users } from '#server/database/schema'
import { getEmailSignInRateLimiterBinding } from '#server/utils/cloudflare'
import { hashToken, verifyPassword } from '#server/utils/auth/password'
import { verifyTurnstile } from '#server/utils/turnstile'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getEmailAuthenticationOriginMock,
  getSessionUserMock,
  readLimitedValidatedJsonBodyMock,
  updateAppSessionMock
} = vi.hoisted(() => {
  type ReadLimitedValidatedJsonBodyMock = (
    event: H3Event,
    maximumByteLength: number,
    validate: ValidateFunction<unknown>
  ) => Promise<unknown>

  return {
    getEmailAuthenticationOriginMock: vi.fn(),
    getSessionUserMock: vi.fn(),
    readLimitedValidatedJsonBodyMock: vi.fn<ReadLimitedValidatedJsonBodyMock>(),
    updateAppSessionMock: vi.fn()
  }
})

// @ts-expect-error -- The test mock deliberately specializes the reader's generic contract to unknown.
vi.mock(import('#server/utils/auth/email-authentication-request'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    readLimitedValidatedJsonBody: readLimitedValidatedJsonBodyMock
  }
})

vi.mock(import('#server/utils/cloudflare'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    getEmailSignInRateLimiterBinding: vi.fn()
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    getEmailAuthenticationOrigin: getEmailAuthenticationOriginMock
  }
})

vi.mock(import('#server/utils/auth/password'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    verifyPassword: vi.fn()
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    updateAppSession: updateAppSessionMock
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    getSessionUser: getSessionUserMock
  }
})

vi.mock(import('#server/utils/turnstile'), () => {
  return { verifyTurnstile: vi.fn() }
})

interface CredentialRow {
  email: string;
  passwordHash: string;
  userId: string;
  isAdmin: boolean;
  sessionVersion: number;
}

interface InvalidHeaderScenario {
  scenario: string;
  headers: Record<string, string>;
  status: number;
}

const origin = 'https://metsik.app'
const clientIp = '203.0.113.40'
const password = 'correct horse battery staple'
const passwordBelowMinimum = 'a'.repeat(14)
const minimumLengthPassword = 'a'.repeat(15)
const maximumLengthPassword = 'a'.repeat(128)
const passwordAboveMaximum = 'a'.repeat(129)
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477cc'
const storedPasswordHash = 'stored-password-hash'
const rateLimitMock = vi.fn<Env['EMAIL_SIGN_IN_RATE_LIMITER']['limit']>()
let requestBody: unknown = null

const signInRequestBody = {
  email: '  One.Trip+test@Example.COM ',
  password,
  'cf-turnstile-response': 'turnstile-token'
}

const credential: CredentialRow = {
  email: 'one.trip+test@example.com',
  passwordHash: storedPasswordHash,
  userId,
  isAdmin: true,
  sessionVersion: 0
}

function createCredentialDatabase(rows: CredentialRow[] = [credential]) {
  const whereMock = vi.fn().mockResolvedValue(rows)

  const innerJoinMock = vi.fn(() => {
    return { where: whereMock }
  })

  const fromMock = vi.fn(() => {
    return { innerJoin: innerJoinMock }
  })

  const selectMock = vi.fn(() => {
    return { from: fromMock }
  })

  return {
    dbHttp: { select: selectMock },
    fromMock,
    innerJoinMock,
    selectMock,
    whereMock
  }
}

function createSignInEvent(dbHttp: unknown, headers: Record<string, string> = {}) {
  const event = createTestEvent(dbHttp)

  Object.assign(event.node.req.headers, {
    'cf-connecting-ip': clientIp,
    'content-type': 'application/json',
    origin,
    ...headers
  })

  return event
}

describe('post /api/auth/email/sign-in', () => {
  beforeEach(() => {
    requestBody = signInRequestBody

    readLimitedValidatedJsonBodyMock.mockImplementation(async (_event, _maximumByteLength, validate) => {
      const result = validate(requestBody)

      if (result === false) {
        throw createError({ status: 400 })
      }

      const resolvedResult = await Promise.resolve(result)

      return resolvedResult
    })

    getEmailAuthenticationOriginMock.mockReturnValue(origin)
    vi.mocked(getEmailSignInRateLimiterBinding).mockReturnValue({ limit: rateLimitMock })

    getSessionUserMock.mockResolvedValue({
      email: null,
      isAdmin: false,
      isGuest: false,
      userId: null
    })

    vi.mocked(verifyPassword).mockResolvedValue(true)
    rateLimitMock.mockResolvedValue({ success: true })

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected failure diagnostics are asserted by the relevant test.
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it('should validate, normalize, rate-limit, verify, authenticate, and update the session in order', async () => {
    const { dbHttp, innerJoinMock, selectMock, whereMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)
    const result = await emailSignInHandler(event)

    expect(readLimitedValidatedJsonBodyMock).toHaveBeenCalledWith(
      event,
      4096,
      expect.any(Function)
    )

    expect(verifyTurnstile).toHaveBeenCalledWith(event, 'turnstile-token', {
      remoteIp: clientIp,
      expectedAction: 'email_sign_in'
    })

    const emailHash = hashToken(credential.email)

    expect(rateLimitMock.mock.calls).toStrictEqual([
      [{ key: `ip:${clientIp}` }],
      [{ key: `email:${emailHash}` }]
    ])

    expect(selectMock).toHaveBeenCalledWith({
      email: emailCredentials.email,
      passwordHash: emailCredentials.passwordHash,
      userId: emailCredentials.userId,
      isAdmin: users.isAdmin,
      sessionVersion: users.sessionVersion
    })

    expect(innerJoinMock).toHaveBeenCalledTimes(1)
    expect(whereMock).toHaveBeenCalledTimes(1)
    expect(verifyPassword).toHaveBeenCalledWith(password, storedPasswordHash)

    expect(updateAppSessionMock).toHaveBeenCalledWith(event, {
      sessionVersion: 0,
      userId
    })

    expect(result).toStrictEqual({
      email: credential.email,
      userId,
      isAdmin: true,
      isGuest: false
    })

    const [originOrder = Number.NaN] = getEmailAuthenticationOriginMock.mock.invocationCallOrder
    const [bodyOrder = Number.NaN] = readLimitedValidatedJsonBodyMock.mock.invocationCallOrder
    const [ipLimiterOrder = Number.NaN, emailLimiterOrder = Number.NaN] = rateLimitMock.mock.invocationCallOrder
    const [turnstileOrder = Number.NaN] = vi.mocked(verifyTurnstile).mock.invocationCallOrder
    const [sessionOrder = Number.NaN] = getSessionUserMock.mock.invocationCallOrder
    const [lookupOrder = Number.NaN] = selectMock.mock.invocationCallOrder
    const [passwordOrder = Number.NaN] = vi.mocked(verifyPassword).mock.invocationCallOrder
    const [updateOrder = Number.NaN] = updateAppSessionMock.mock.invocationCallOrder

    expect(originOrder).toBeLessThan(bodyOrder)
    expect(bodyOrder).toBeLessThan(ipLimiterOrder)
    expect(ipLimiterOrder).toBeLessThan(turnstileOrder)
    expect(turnstileOrder).toBeLessThan(emailLimiterOrder)
    expect(emailLimiterOrder).toBeLessThan(sessionOrder)
    expect(sessionOrder).toBeLessThan(lookupOrder)
    expect(lookupOrder).toBeLessThan(passwordOrder)
    expect(passwordOrder).toBeLessThan(updateOrder)
  })

  it.each([
    ['unknown email', [], false],
    ['malformed hash', [{
      ...credential,
      passwordHash: 'malformed'
    }], false],
    ['wrong password', [credential], false]
  ])('should return the same 401 for %s', async (_scenario, rows, passwordMatches) => {
    const { dbHttp } = createCredentialDatabase(rows)
    const event = createSignInEvent(dbHttp)

    vi.mocked(verifyPassword).mockResolvedValue(passwordMatches)

    await expect(emailSignInHandler(event)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Email or password is incorrect'
    })

    expect(verifyPassword).toHaveBeenCalledTimes(1)
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should verify an unknown email with a valid dummy scrypt hash', async () => {
    const { dbHttp } = createCredentialDatabase([])
    const event = createSignInEvent(dbHttp)

    vi.mocked(verifyPassword).mockResolvedValue(false)
    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 401 })

    const encodedHash = vi.mocked(verifyPassword).mock.calls[0]?.[1]

    expect(encodedHash).toBeTypeOf('string')

    const actualPasswordModule = await vi.importActual<{ verifyPassword: typeof verifyPassword; }>(
      '#server/utils/auth/password'
    )

    await expect(actualPasswordModule.verifyPassword('not-a-user-password', String(encodedHash))).resolves.toBe(true)
  })

  const invalidHeaderScenarios: InvalidHeaderScenario[] = [
    {
      scenario: 'invalid content type',
      headers: { 'content-type': 'text/plain' },
      status: 415
    },
    {
      scenario: 'wrong origin',
      headers: { origin: 'https://other.example' },
      status: 403
    },
    {
      scenario: 'cross-site request',
      headers: { 'sec-fetch-site': 'cross-site' },
      status: 403
    }
  ]

  it.each(invalidHeaderScenarios)('should reject $scenario before reading a malformed body', async ({ headers, status }) => {
    requestBody = {}

    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp, headers)

    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: status })
    expect(readLimitedValidatedJsonBodyMock).not.toHaveBeenCalled()
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should reject an invalid body before rate limits, Turnstile, and downstream work', async () => {
    requestBody = {}

    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(readLimitedValidatedJsonBodyMock).toHaveBeenCalledTimes(1)
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it.each([
    ['below the minimum', passwordBelowMinimum],
    ['above the maximum', passwordAboveMaximum]
  ])('should reject a password %s length before rate limits and Turnstile', async (_scenario, invalidPassword) => {
    requestBody = {
      ...signInRequestBody,
      password: invalidPassword
    }

    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(readLimitedValidatedJsonBodyMock).toHaveBeenCalledTimes(1)
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
  })

  it.each([
    ['minimum', minimumLengthPassword],
    ['maximum', maximumLengthPassword]
  ])('should accept a password at the %s length boundary', async (_scenario, boundaryPassword) => {
    requestBody = {
      ...signInRequestBody,
      password: boundaryPassword
    }

    const { dbHttp } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    await expect(emailSignInHandler(event)).resolves.toMatchObject({ userId })
    expect(verifyPassword).toHaveBeenCalledWith(boundaryPassword, storedPasswordHash)
  })

  it('should stop rejected Turnstile after the IP limit and before the email limit and downstream work', async () => {
    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    vi.mocked(verifyTurnstile).mockRejectedValue(createError({ status: 403 }))
    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(rateLimitMock.mock.calls).toStrictEqual([[{ key: `ip:${clientIp}` }]])
    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      configureRateLimit: () => {
        rateLimitMock.mockResolvedValueOnce({ success: false })
      },

      deniedKey: `ip:${clientIp}`,
      scope: 'IP',
      turnstileCallCount: 0
    },
    {
      configureRateLimit: () => {
        rateLimitMock
          .mockResolvedValueOnce({ success: true })
          .mockResolvedValueOnce({ success: false })
      },

      deniedKey: `email:${hashToken(credential.email)}`,
      scope: 'email',
      turnstileCallCount: 1
    }
  ] as const)('should stop a denied $scope limit before session, credentials, and password work', async ({
    configureRateLimit,
    deniedKey,
    turnstileCallCount
  }) => {
    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    configureRateLimit()
    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 429 })
    expect(event.node.res.getHeader('Retry-After')).toBe(60)
    expect(verifyTurnstile).toHaveBeenCalledTimes(turnstileCallCount)
    expect(rateLimitMock).toHaveBeenCalledWith({ key: deniedKey })
    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should reject an existing session without credentials, password, or cookie work', async () => {
    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    getSessionUserMock.mockResolvedValue({
      email: credential.email,
      isAdmin: true,
      isGuest: false,
      userId
    })

    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 409 })
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should return a safe 503 and sanitized diagnostics when credential lookup fails', async () => {
    const { dbHttp, whereMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)
    const sqlParameter = 'sql-parameter-secret'

    const databaseError = new DrizzleQueryError(
      'SELECT * FROM email_credentials WHERE email = $1 AND marker = $2',
      [credential.email, sqlParameter],
      new Error(`Database unavailable for ${credential.email}`)
    )

    whereMock.mockRejectedValue(databaseError)

    await expect(emailSignInHandler(event)).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'Email sign-in is temporarily unavailable'
    })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).toContain('Email sign-in credential lookup failed')
    expect(telemetry).toContain('Database query failed')
    expect(telemetry).toContain('Database unavailable for [REDACTED]')
    expect(telemetry).not.toContain(credential.email)
    expect(telemetry).not.toContain(sqlParameter)
    expect(telemetry).not.toContain('SELECT * FROM email_credentials')
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      configureRateLimit: () => {
        rateLimitMock.mockRejectedValueOnce(new Error(`Limiter failed for ip:${clientIp}`))
      },

      failedKey: `ip:${clientIp}`,
      scope: 'IP',
      turnstileCallCount: 0
    },
    {
      configureRateLimit: () => {
        const emailKey = `email:${hashToken(credential.email)}`

        rateLimitMock
          .mockResolvedValueOnce({ success: true })
          .mockRejectedValueOnce(new Error(`Limiter failed for ${emailKey}`))
      },

      failedKey: `email:${hashToken(credential.email)}`,
      scope: 'email',
      turnstileCallCount: 1
    }
  ] as const)('should return a safe 503 and redact the failed $scope limiter key', async ({
    configureRateLimit,
    failedKey,
    turnstileCallCount
  }) => {
    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    configureRateLimit()

    await expect(emailSignInHandler(event)).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'Email sign-in is temporarily unavailable'
    })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).toContain('Email sign-in rate limit failed')
    expect(telemetry).toContain('[REDACTED]')
    expect(telemetry).not.toContain(failedKey)
    expect(verifyTurnstile).toHaveBeenCalledTimes(turnstileCallCount)
    expect(rateLimitMock).toHaveBeenCalledWith({ key: failedKey })
    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should read the email sign-in limiter binding independently from the Guest limiter', async () => {
    const actualCloudflareModule = await vi.importActual<typeof CloudflareModule>(
      '#server/utils/cloudflare'
    )

    const emailSignInBinding = {
      limit: vi.fn<Env['EMAIL_SIGN_IN_RATE_LIMITER']['limit']>()
    }

    const guestSessionBinding = {
      limit: vi.fn<Env['GUEST_SESSION_RATE_LIMITER']['limit']>()
    }

    const event = createTestEvent({})

    Object.assign(event.context, {
      cloudflare: {
        env: {
          EMAIL_SIGN_IN_RATE_LIMITER: emailSignInBinding,
          GUEST_SESSION_RATE_LIMITER: guestSessionBinding
        }
      }
    })

    expect(actualCloudflareModule.getEmailSignInRateLimiterBinding(event)).toBe(emailSignInBinding)
  })
})
