import { createApp, createError, toWebHandler } from 'h3'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import passwordRecoveryHandler from '#server/api/auth/email/password-recovery.post'
import passwordRecoveryResetHandler from '#server/api/auth/email/password-recovery/reset.post'
import { getEmailAuthenticationConfig, getRuntimeDatabaseConfig } from '#server/utils/config'
import { getEmailBinding, getPasswordRecoveryRateLimiterBinding } from '#server/utils/cloudflare'
import { hashPassword, hashToken } from '#server/utils/auth/password'
import { runPasswordRecoveryIssuance, withPasswordRecoveryDatabase } from '#server/utils/auth/password-recovery'
import { assertPasswordNotPwned } from '#server/utils/auth/pwned-passwords'
import { completePasswordRecovery, findPasswordRecoveryEmail } from '#server/utils/auth/password-recovery-persistence'
import { verifyTurnstile } from '#server/utils/turnstile'
import { createWebSocketClient } from '#server/utils/database'

vi.mock(import('#server/utils/config'), () => {
  return {
    getEmailAuthenticationConfig: vi.fn(),
    getRuntimeDatabaseConfig: vi.fn()
  }
})

vi.mock(import('#server/utils/cloudflare'), async (importOriginal) => {
  return {
    ...await importOriginal(),
    getEmailBinding: vi.fn(),
    getPasswordRecoveryRateLimiterBinding: vi.fn()
  }
})

vi.mock(import('#server/utils/auth/password'), async (importOriginal) => {
  return {
    ...await importOriginal(),
    hashPassword: vi.fn()
  }
})

vi.mock(import('#server/utils/auth/password-recovery'), () => {
  return {
    runPasswordRecoveryIssuance: vi.fn(),
    withPasswordRecoveryDatabase: vi.fn()
  }
})

vi.mock(import('#server/utils/auth/password-recovery-persistence'), async (importOriginal) => {
  return {
    ...await importOriginal(),
    completePasswordRecovery: vi.fn(),
    findPasswordRecoveryEmail: vi.fn()
  }
})

vi.mock(import('#server/utils/auth/pwned-passwords'), () => {
  return { assertPasswordNotPwned: vi.fn() }
})

vi.mock(import('#server/utils/turnstile'), () => {
  return { verifyTurnstile: vi.fn() }
})

const origin = 'https://metsik.app'
const clientIp = '203.0.113.41'
const normalizedEmail = 'one.trip+test@example.com'
const token = 'a'.repeat(43)
const password = 'a strong password phrase'

const databaseConfig = {
  databaseUrl: 'postgresql://test:test@localhost/test',
  isLocalDatabase: true
}

const database = createWebSocketClient(databaseConfig)
const limitMock = vi.fn<Env['PASSWORD_RECOVERY_RATE_LIMITER']['limit']>()
const waitUntilMock = vi.fn<(promise: Promise<unknown>) => void>()
const emailSendMock = vi.fn<(message: EmailMessage | EmailMessageBuilder) => Promise<EmailSendResult>>()

const emailBinding: Env['EMAIL'] = {
  async send(message: EmailMessage | EmailMessageBuilder) {
    return emailSendMock(message)
  }
}

function recoveryRequestBody() {
  return {
    email: '  One.Trip+test@Example.COM ',
    redirectTo: '/account',
    'cf-turnstile-response': 'turnstile-token'
  }
}

function resetRequestBody() {
  return {
    token,
    password,
    'cf-turnstile-response': 'turnstile-token'
  }
}

async function request(
  body: unknown,
  options: {
    headers?: Record<string, string>;
    reset?: boolean;
  } = {}
) {
  const app = createApp()

  if (options.reset !== true) {
    app.use((event) => {
      event.waitUntil = waitUntilMock
    })
  }

  app.use(options.reset === true ? passwordRecoveryResetHandler : passwordRecoveryHandler)

  return toWebHandler(app)(new Request(origin, {
    method: 'POST',

    headers: {
      'cf-connecting-ip': clientIp,
      'content-type': 'application/json',
      origin,
      ...options.headers
    },

    body: JSON.stringify(body)
  }))
}

describe('email password recovery API', () => {
  beforeEach(() => {
    vi.mocked(getEmailAuthenticationConfig).mockReturnValue({
      origin,
      stagingRecipient: null
    })

    vi.mocked(getRuntimeDatabaseConfig).mockReturnValue(databaseConfig)
    vi.mocked(getEmailBinding).mockReturnValue(emailBinding)
    vi.mocked(getPasswordRecoveryRateLimiterBinding).mockReturnValue({ limit: limitMock })
    vi.mocked(runPasswordRecoveryIssuance).mockResolvedValue()
    vi.mocked(findPasswordRecoveryEmail).mockResolvedValue(normalizedEmail)
    vi.mocked(hashPassword).mockResolvedValue('new-password-hash')
    vi.mocked(withPasswordRecoveryDatabase).mockImplementation(async (_event, _sensitive, action) => action(database))
    limitMock.mockResolvedValue({ success: true })

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected failure diagnostics are asserted by their owning utility.
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await database.$client.end()
  })

  it('normalizes email and schedules the same accepted background work after Turnstile and rate limits', async () => {
    const response = await request(recoveryRequestBody())
    const body: unknown = await response.json()

    expect(response.status).toBe(202)
    expect(body).toStrictEqual({ accepted: true })

    expect(verifyTurnstile).toHaveBeenCalledWith(expect.anything(), 'turnstile-token', {
      remoteIp: clientIp,
      expectedAction: 'password_recovery_request'
    })

    expect(limitMock.mock.calls).toStrictEqual([
      [{ key: `request-ip:${clientIp}` }],
      [{ key: `request-email:${hashToken(normalizedEmail)}` }]
    ])

    expect(runPasswordRecoveryIssuance).toHaveBeenCalledWith({
      binding: emailBinding,

      config: {
        origin,
        stagingRecipient: null
      },

      databaseConfig,
      email: normalizedEmail,
      redirectTo: '/account',
      token: expect.stringMatching(/^[\w-]{43}$/u) as unknown,
      tokenHash: expect.stringMatching(/^[\da-f]{64}$/u) as unknown
    })

    expect(waitUntilMock).toHaveBeenCalledTimes(1)

    const [turnstileOrder = Number.NaN] = vi.mocked(verifyTurnstile).mock.invocationCallOrder
    const [limitOrder = Number.NaN] = limitMock.mock.invocationCallOrder
    const [backgroundOrder = Number.NaN] = vi.mocked(runPasswordRecoveryIssuance).mock.invocationCallOrder

    expect(turnstileOrder).toBeLessThan(limitOrder)
    expect(limitOrder).toBeLessThan(backgroundOrder)
  })

  it.each([
    ['known account', normalizedEmail],
    ['unknown account', 'unknown@example.com']
  ])('keeps the synchronous response identical for a %s', async (_scenario, email) => {
    const response = await request({
      email,
      redirectTo: '/',
      'cf-turnstile-response': 'turnstile-token'
    })

    await expect(response.json()).resolves.toStrictEqual({ accepted: true })
    expect(response.status).toBe(202)
    expect(runPasswordRecoveryIssuance).toHaveBeenCalledTimes(1)
  })

  it('returns before unresolved background issuance finishes', async () => {
    const background = Promise.withResolvers<never>().promise

    vi.mocked(runPasswordRecoveryIssuance).mockReturnValue(background)

    const response = await request(recoveryRequestBody())

    expect(response.status).toBe(202)
    expect(waitUntilMock).toHaveBeenCalledWith(background)
  })

  it.each([
    ['wrong origin', { origin: 'https://other.example' }, 403],
    ['cross-site request', { 'sec-fetch-site': 'cross-site' }, 403],
    ['wrong content type', { 'content-type': 'text/plain' }, 415]
  ])('rejects a %s before Turnstile and downstream work', async (_scenario, headers, status) => {
    const response = await request(recoveryRequestBody(), { headers })

    expect(response.status).toBe(status)
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(limitMock).not.toHaveBeenCalled()
    expect(runPasswordRecoveryIssuance).not.toHaveBeenCalled()
  })

  it('rejects an oversized body before Turnstile and downstream work', async () => {
    const response = await request({
      email: `${'a'.repeat(4096)}@example.com`,
      'cf-turnstile-response': 'turnstile-token'
    })

    expect(response.status).toBe(413)
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(limitMock).not.toHaveBeenCalled()
    expect(runPasswordRecoveryIssuance).not.toHaveBeenCalled()
  })

  it.each([
    ['wrong origin', { origin: 'https://other.example' }, 403],
    ['cross-site request', { 'sec-fetch-site': 'cross-site' }, 403],
    ['wrong content type', { 'content-type': 'text/plain' }, 415]
  ])('rejects a reset with a %s before Turnstile and database work', async (_scenario, headers, status) => {
    const response = await request(resetRequestBody(), {
      headers,
      reset: true
    })

    expect(response.status).toBe(status)
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(limitMock).not.toHaveBeenCalled()
    expect(withPasswordRecoveryDatabase).not.toHaveBeenCalled()
  })

  it('rejects an oversized reset body before Turnstile and database work', async () => {
    const response = await request({
      ...resetRequestBody(),
      password: 'a'.repeat(4096)
    }, { reset: true })

    expect(response.status).toBe(413)
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(limitMock).not.toHaveBeenCalled()
    expect(withPasswordRecoveryDatabase).not.toHaveBeenCalled()
  })

  it('returns Retry-After when either recovery quota is denied', async () => {
    limitMock.mockResolvedValueOnce({ success: false })

    const response = await request(recoveryRequestBody())

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(runPasswordRecoveryIssuance).not.toHaveBeenCalled()
  })

  it('stops an invalid Turnstile attempt before rate limits and background work', async () => {
    vi.mocked(verifyTurnstile).mockRejectedValue(createError({ status: 403 }))

    const response = await request(recoveryRequestBody())

    expect(response.status).toBe(403)
    expect(limitMock).not.toHaveBeenCalled()
    expect(runPasswordRecoveryIssuance).not.toHaveBeenCalled()
  })

  it('returns a safe 503 when required email delivery is unavailable', async () => {
    vi.mocked(getEmailBinding).mockImplementation(() => {
      throw createError({
        status: 503,
        statusMessage: 'Email delivery is temporarily unavailable'
      })
    })

    const response = await request(recoveryRequestBody())

    expect(response.status).toBe(503)

    await expect(response.json()).resolves.toMatchObject({
      statusMessage: 'Email delivery is temporarily unavailable'
    })

    expect(runPasswordRecoveryIssuance).not.toHaveBeenCalled()
  })

  it('returns a safe 503 when the recovery limiter fails', async () => {
    limitMock.mockRejectedValue(new Error('Limiter unavailable'))

    const response = await request(recoveryRequestBody())

    expect(response.status).toBe(503)

    await expect(response.json()).resolves.toMatchObject({
      statusMessage: 'Password recovery is temporarily unavailable'
    })

    expect(runPasswordRecoveryIssuance).not.toHaveBeenCalled()
  })

  it('validates reset Turnstile, applies IP and email quotas, screens, hashes, and commits in order', async () => {
    const response = await request(resetRequestBody(), { reset: true })

    await expect(response.json()).resolves.toStrictEqual({ reset: true })
    expect(response.status).toBe(200)

    expect(limitMock.mock.calls).toStrictEqual([
      [{ key: `reset-ip:${clientIp}` }],
      [{ key: `reset-email:${hashToken(normalizedEmail)}` }]
    ])

    expect(verifyTurnstile).toHaveBeenCalledWith(expect.anything(), 'turnstile-token', {
      remoteIp: clientIp,
      expectedAction: 'password_recovery_reset'
    })

    expect(completePasswordRecovery).toHaveBeenCalledWith(database, {
      email: normalizedEmail,
      passwordHash: 'new-password-hash',
      tokenHash: hashToken(token)
    })

    const [turnstileOrder = Number.NaN] = vi.mocked(verifyTurnstile).mock.invocationCallOrder
    const [ipOrder = Number.NaN, emailOrder = Number.NaN] = limitMock.mock.invocationCallOrder
    const [lookupOrder = Number.NaN] = vi.mocked(findPasswordRecoveryEmail).mock.invocationCallOrder
    const [hibpOrder = Number.NaN] = vi.mocked(assertPasswordNotPwned).mock.invocationCallOrder
    const [hashOrder = Number.NaN] = vi.mocked(hashPassword).mock.invocationCallOrder
    const [completeOrder = Number.NaN] = vi.mocked(completePasswordRecovery).mock.invocationCallOrder

    expect(turnstileOrder).toBeLessThan(ipOrder)
    expect(ipOrder).toBeLessThan(lookupOrder)
    expect(lookupOrder).toBeLessThan(emailOrder)
    expect(emailOrder).toBeLessThan(hibpOrder)
    expect(hibpOrder).toBeLessThan(hashOrder)
    expect(hashOrder).toBeLessThan(completeOrder)
  })

  it('rejects malformed reset tokens safely after Turnstile and before HIBP, hashing, and database work', async () => {
    const response = await request({
      ...resetRequestBody(),
      token: 'malformed'
    }, { reset: true })

    expect(response.status).toBe(400)

    await expect(response.json()).resolves.toMatchObject({
      statusMessage: 'The password reset link is invalid or expired'
    })

    expect(verifyTurnstile).toHaveBeenCalledTimes(1)
    expect(limitMock).toHaveBeenCalledExactlyOnceWith({ key: `reset-ip:${clientIp}` })
    expect(assertPasswordNotPwned).not.toHaveBeenCalled()
    expect(hashPassword).not.toHaveBeenCalled()
    expect(withPasswordRecoveryDatabase).not.toHaveBeenCalled()
  })

  it('stops an invalid or expired token before HIBP and password hashing', async () => {
    vi.mocked(findPasswordRecoveryEmail).mockRejectedValue(createError({
      status: 400,
      statusMessage: 'The password reset link is invalid or expired'
    }))

    const response = await request(resetRequestBody(), { reset: true })

    expect(response.status).toBe(400)
    expect(assertPasswordNotPwned).not.toHaveBeenCalled()
    expect(hashPassword).not.toHaveBeenCalled()
    expect(completePasswordRecovery).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'Choose a password that has not appeared in a data breach'],
    [503, 'Password checking is temporarily unavailable']
  ])('preserves a safe HIBP failure and does not hash or update (%s)', async (status, statusMessage) => {
    vi.mocked(assertPasswordNotPwned).mockRejectedValue(createError({
      status,
      statusMessage
    }))

    const response = await request(resetRequestBody(), { reset: true })

    expect(response.status).toBe(status)
    expect(hashPassword).not.toHaveBeenCalled()
    expect(completePasswordRecovery).not.toHaveBeenCalled()
  })
})
