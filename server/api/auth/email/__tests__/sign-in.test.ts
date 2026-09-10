import { createError, type H3Event, type ValidateFunction } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import emailSignInHandler from '#server/api/auth/email/sign-in.post'
import { emailCredentials, users } from '#server/database/schema'
import { getEmailSignInRateLimiterBinding } from '#server/utils/cloudflare'
import { hashToken, verifyPassword } from '#server/utils/auth/password'
import { verifyTurnstile } from '#server/utils/turnstile'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getAppSessionMock,
  getEmailAuthenticationOriginMock,
  readValidatedBodyMock,
  setResponseHeaderMock,
  updateAppSessionMock
} = vi.hoisted(() => {
  type ReadValidatedBodyMock = (
    event: H3Event,
    validate: ValidateFunction<unknown>
  ) => Promise<unknown>

  return {
    getAppSessionMock: vi.fn(),
    getEmailAuthenticationOriginMock: vi.fn(),
    readValidatedBodyMock: vi.fn<ReadValidatedBodyMock>(),
    setResponseHeaderMock: vi.fn(),
    updateAppSessionMock: vi.fn()
  }
})

// @ts-expect-error -- The test mock deliberately specializes readValidatedBody's generic contract to unknown.
vi.mock(import('h3'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    readValidatedBody: readValidatedBodyMock,
    setResponseHeader: setResponseHeaderMock
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
    getAppSession: getAppSessionMock,
    updateAppSession: updateAppSessionMock
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
}

interface InvalidRequestScenario {
  scenario: string;
  body: unknown;
  headers: Record<string, string>;
  status: number;
}

const origin = 'https://metsik.app'
const clientIp = '203.0.113.40'
const password = 'correct horse battery staple'
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
  isAdmin: true
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

    readValidatedBodyMock.mockImplementation(async (_event, validate) => {
      const result = validate(requestBody)

      if (result === false) {
        throw createError({ status: 400 })
      }

      const resolvedResult = await Promise.resolve(result)

      return resolvedResult
    })

    getEmailAuthenticationOriginMock.mockReturnValue(origin)
    vi.mocked(getEmailSignInRateLimiterBinding).mockReturnValue({ limit: rateLimitMock })
    getAppSessionMock.mockResolvedValue({ data: {} })
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

  it('should normalize, verify, rate-limit, authenticate, and update the session in order', async () => {
    const { dbHttp, innerJoinMock, selectMock, whereMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)
    const result = await emailSignInHandler(event)

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
      isAdmin: users.isAdmin
    })

    expect(innerJoinMock).toHaveBeenCalledTimes(1)
    expect(whereMock).toHaveBeenCalledTimes(1)
    expect(verifyPassword).toHaveBeenCalledWith(password, storedPasswordHash)
    expect(updateAppSessionMock).toHaveBeenCalledWith(event, { userId })

    expect(result).toStrictEqual({
      email: credential.email,
      userId,
      isAdmin: true,
      isGuest: false
    })

    const [turnstileOrder = Number.NaN] = vi.mocked(verifyTurnstile).mock.invocationCallOrder
    const limiterOrders = rateLimitMock.mock.invocationCallOrder
    const limiterOrder = Math.max(...limiterOrders)
    const [sessionOrder = Number.NaN] = getAppSessionMock.mock.invocationCallOrder
    const [lookupOrder = Number.NaN] = selectMock.mock.invocationCallOrder
    const [passwordOrder = Number.NaN] = vi.mocked(verifyPassword).mock.invocationCallOrder
    const [updateOrder = Number.NaN] = updateAppSessionMock.mock.invocationCallOrder

    expect(turnstileOrder).toBeLessThan(limiterOrder)
    expect(limiterOrder).toBeLessThan(sessionOrder)
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

  const invalidRequestScenarios: InvalidRequestScenario[] = [
    {
      scenario: 'invalid body',
      body: {},
      headers: {},
      status: 400
    },
    {
      scenario: 'invalid content type',
      body: signInRequestBody,
      headers: { 'content-type': 'text/plain' },
      status: 415
    },
    {
      scenario: 'wrong origin',
      body: signInRequestBody,
      headers: { origin: 'https://other.example' },
      status: 403
    },
    {
      scenario: 'cross-site request',
      body: signInRequestBody,
      headers: { 'sec-fetch-site': 'cross-site' },
      status: 403
    }
  ]

  it.each(invalidRequestScenarios)('should reject $scenario before Turnstile and downstream work', async ({ body, headers, status }) => {
    requestBody = body

    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp, headers)

    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: status })
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(getAppSessionMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should stop rejected Turnstile before rate limits, session, credentials, and password work', async () => {
    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    vi.mocked(verifyTurnstile).mockRejectedValue(createError({ status: 403 }))
    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(getAppSessionMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should stop a limited attempt before session, credentials, and password work', async () => {
    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    rateLimitMock.mockResolvedValueOnce({ success: false })
    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 429 })
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Retry-After', 60)
    expect(getAppSessionMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should reject an existing session without credentials, password, or cookie work', async () => {
    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)

    getAppSessionMock.mockResolvedValue({
      data: { userId }
    })

    await expect(emailSignInHandler(event)).rejects.toMatchObject({ statusCode: 409 })
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })

  it('should return a safe 503 and sanitized diagnostics when the limiter binding fails', async () => {
    const { dbHttp, selectMock } = createCredentialDatabase()
    const event = createSignInEvent(dbHttp)
    const ipKey = `ip:${clientIp}`

    rateLimitMock.mockRejectedValue(new Error(`Limiter failed for ${ipKey}`))

    await expect(emailSignInHandler(event)).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'Email sign-in is temporarily unavailable'
    })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).toContain('Email sign-in rate limit failed')
    expect(telemetry).toContain('[REDACTED]')
    expect(telemetry).not.toContain(ipKey)
    expect(getAppSessionMock).not.toHaveBeenCalled()
    expect(selectMock).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(updateAppSessionMock).not.toHaveBeenCalled()
  })
})
