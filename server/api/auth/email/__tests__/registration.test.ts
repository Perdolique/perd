import { createWebSocketClient } from '#server/utils/database'
import { createApp, createError, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import registrationHandler from '#server/api/auth/email/registration.post'
import verificationHandler from '#server/api/auth/email/registration/verify.post'
import { getEmailRegistrationConfig } from '#server/utils/config'
import { verifyTurnstile } from '#server/utils/turnstile'
import { assertPasswordNotPwned } from '#server/utils/auth/pwned-passwords'
import { hashPassword, hashToken } from '#server/utils/auth/password'
import { getRegistrationActor, withRegistrationDatabase } from '#server/utils/auth/email-registration'
import { issueEmailRegistration, completeEmailRegistration } from '#server/utils/auth/email-registration-persistence'
import { sendRegistrationEmail } from '#server/utils/auth/email-registration-mail'
import { enforceEmailAuthenticationRateLimit } from '#server/utils/auth/email-authentication-request'
import { updateAppSession } from '#server/utils/session'

vi.mock(import('#server/utils/config'), () => {
  return { getEmailRegistrationConfig: vi.fn() }
})

vi.mock(import('#server/utils/turnstile'), () => {
  return { verifyTurnstile: vi.fn() }
})

vi.mock(import('#server/utils/auth/pwned-passwords'), () => {
  return { assertPasswordNotPwned: vi.fn() }
})

vi.mock(import('#server/utils/auth/password'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    hashPassword: vi.fn()
  }
})

vi.mock(import('#server/utils/auth/email-registration'), () => {
  return {
    getRegistrationActor: vi.fn(),
    withRegistrationDatabase: vi.fn()
  }
})

vi.mock(import('#server/utils/auth/email-registration-persistence'), () => {
  return {
    issueEmailRegistration: vi.fn(),
    completeEmailRegistration: vi.fn()
  }
})

vi.mock(import('#server/utils/auth/email-registration-mail'), () => {
  return { sendRegistrationEmail: vi.fn() }
})

vi.mock(import('#server/utils/auth/email-authentication-request'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    enforceEmailAuthenticationRateLimit: vi.fn()
  }
})

vi.mock(import('#server/utils/session'), () => {
  return { updateAppSession: vi.fn() }
})

const password = 'registration contract test password'

const database = createWebSocketClient({
  databaseUrl: 'postgresql://test:test@localhost/test',
  isLocalDatabase: true
})

const origin = 'https://metsik.app'

async function request(body: unknown, verify = false, headers: Record<string, string> = {}) {
  const app = createApp()

  app.use(verify ? verificationHandler : registrationHandler)

  const handler = toWebHandler(app)
  const encodedBody = JSON.stringify(body)

  const httpRequest = new Request(origin, {
    method: 'POST',

    headers: {
      'content-type': 'application/json',
      origin,
      'cf-connecting-ip': '203.0.113.1',
      ...headers
    },

    body: encodedBody
  })

  return handler(httpRequest)
}

function registrationBody() {
  return {
    email: '  One.Trip+test@Example.COM ',
    password,
    redirectTo: '/my-gear',
    'cf-turnstile-response': 'turnstile-test'
  }
}

describe('email registration API', () => {
  beforeEach(() => {
    vi.mocked(getEmailRegistrationConfig).mockReturnValue({
      origin,
      stagingRecipient: null
    })

    vi.mocked(hashPassword).mockResolvedValue('stored-password-hash')

    vi.mocked(getRegistrationActor).mockResolvedValue({
      userId: null,
      sessionIdHash: null
    })

    vi.mocked(withRegistrationDatabase).mockImplementation(async (_event, _sensitive, action) => action(database))

    vi.spyOn(console, 'error').mockImplementation(() => {
 // Expected failure diagnostics are asserted at their owning layer.
 })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it.each([false, true])('should return the same accepted response and send the appropriate mail, existing=%s', async (existing) => {
    vi.mocked(issueEmailRegistration).mockImplementation(async (_database, _options, sendMail) => {
      await sendMail(existing)
    })

    const response = await request(registrationBody())
    const body: unknown = await response.json()

    expect(response.status).toBe(202)
    expect(body).toStrictEqual({ accepted: true })

    expect(verifyTurnstile).toHaveBeenCalledWith(expect.anything(), 'turnstile-test', {
      remoteIp: '203.0.113.1',
      expectedAction: 'email_registration'
    })

    expect(issueEmailRegistration).toHaveBeenCalledWith(database, expect.objectContaining({
      email: 'one.trip+test@example.com',
      passwordHash: 'stored-password-hash',
      redirectTo: '/my-gear',
      tokenHash: expect.stringMatching(/^[\da-f]{64}$/u) as unknown
    }), expect.any(Function))

    expect(sendRegistrationEmail).toHaveBeenCalledWith(expect.anything(), {
      origin,
      stagingRecipient: null
    }, {
      email: 'one.trip+test@example.com',
      token: expect.stringMatching(/^[\w-]{43}$/u) as unknown,
      isExistingAccount: existing
    })

    const [turnstileOrder = Number.NaN] = vi.mocked(verifyTurnstile).mock.invocationCallOrder
    const [rateOrder = Number.NaN] = vi.mocked(enforceEmailAuthenticationRateLimit).mock.invocationCallOrder
    const [hibpOrder = Number.NaN] = vi.mocked(assertPasswordNotPwned).mock.invocationCallOrder
    const [hashOrder = Number.NaN] = vi.mocked(hashPassword).mock.invocationCallOrder
    const [actorOrder = Number.NaN] = vi.mocked(getRegistrationActor).mock.invocationCallOrder

    expect(turnstileOrder).toBeLessThan(rateOrder)
    expect(rateOrder).toBeLessThan(hibpOrder)
    expect(hashOrder).toBeLessThan(actorOrder)
  })

  it('should stop before all side effects when disabled', async () => {
    vi.mocked(getEmailRegistrationConfig).mockImplementation(() => { throw createError({ status: 404 }) })

    const response = await request(registrationBody())

    expect(response.status).toBe(404)
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(withRegistrationDatabase).not.toHaveBeenCalled()
  })

  it.each([
    ['origin', { origin: 'https://other.example' }, 403],
    ['content type', { 'content-type': 'text/plain' }, 415]
  ])('should reject invalid %s before verification or database work', async (_name, headers, status) => {
    const response = await request(registrationBody(), false, headers)

    expect(response.status).toBe(status)
    expect(verifyTurnstile).not.toHaveBeenCalled()
    expect(withRegistrationDatabase).not.toHaveBeenCalled()
  })

  it('should stop invalid Turnstile before rate limits, password work, and database calls', async () => {
    vi.mocked(verifyTurnstile).mockRejectedValue(createError({ status: 403 }))

    const response = await request(registrationBody())

    expect(response.status).toBe(403)
    expect(enforceEmailAuthenticationRateLimit).not.toHaveBeenCalled()
    expect(assertPasswordNotPwned).not.toHaveBeenCalled()
    expect(withRegistrationDatabase).not.toHaveBeenCalled()
  })

  it('should stop rate-limited attempts before password or database work', async () => {
    vi.mocked(enforceEmailAuthenticationRateLimit).mockRejectedValue(createError({ status: 429 }))

    const response = await request(registrationBody())

    expect(response.status).toBe(429)
    expect(hashPassword).not.toHaveBeenCalled()
    expect(assertPasswordNotPwned).not.toHaveBeenCalled()
    expect(withRegistrationDatabase).not.toHaveBeenCalled()
  })

  it.each([400, 503])('should stop failed HIBP checks before hashing, database access, and mail (%s)', async (status) => {
    vi.mocked(assertPasswordNotPwned).mockRejectedValue(createError({ status }))

    const response = await request(registrationBody())

    expect(response.status).toBe(status)
    expect(hashPassword).not.toHaveBeenCalled()
    expect(withRegistrationDatabase).not.toHaveBeenCalled()
    expect(sendRegistrationEmail).not.toHaveBeenCalled()
  })

  it('should refuse a non-allowlisted staging address without rewriting its recipient', async () => {
    vi.mocked(getEmailRegistrationConfig).mockReturnValue({
      origin,
      stagingRecipient: 'owner@example.com'
    })

    const response = await request(registrationBody())

    expect(response.status).toBe(400)
    expect(assertPasswordNotPwned).not.toHaveBeenCalled()
    expect(withRegistrationDatabase).not.toHaveBeenCalled()
  })

  it.each([[true, 1], [false, 0]] as const)('should create a session only for a new user (%s)', async (isNewUser, expectedUpdates) => {
    vi.mocked(completeEmailRegistration).mockResolvedValue({
      userId: 'user-1',
      email: 'one@example.com',
      isAdmin: false,
      isNewUser,
      redirectTo: '/my-gear'
    })

    const token = 'a'.repeat(43)

    const response = await request({
      token,
      password
    }, true)

    const body: unknown = await response.json()

    expect(response.status).toBe(200)

    expect(body).toStrictEqual({
      user: {
        userId: 'user-1',
        email: 'one@example.com',
        isAdmin: false,
        isGuest: false
      },

      redirectTo: '/my-gear'
    })

    expect(updateAppSession).toHaveBeenCalledTimes(expectedUpdates)

    expect(completeEmailRegistration).toHaveBeenCalledWith(database, {
      actor: {
        userId: null,
        sessionIdHash: null
      },

      password,
      tokenHash: hashToken(token)
    })
  })

  it('should leave the session alone when confirmation conflicts', async () => {
    vi.mocked(completeEmailRegistration).mockRejectedValue(createError({ status: 409 }))

    const response = await request({
      token: 'a'.repeat(43),
      password
    }, true)

    expect(response.status).toBe(409)
    expect(updateAppSession).not.toHaveBeenCalled()
  })
})
