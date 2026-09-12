import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { createWebSocketClient } from '#server/utils/database'
import { getRuntimeDatabaseConfig } from '#server/utils/config'
import { issuePasswordRecovery, revokePasswordRecoveryToken } from '#server/utils/auth/password-recovery-persistence'
import { sendPasswordRecoveryEmail } from '#server/utils/auth/password-recovery-mail'
import { runPasswordRecoveryIssuance, withPasswordRecoveryDatabase } from '#server/utils/auth/password-recovery'
import { createTestEvent } from '~~/test-utils/create-test-event'

vi.mock(import('#server/utils/database'), () => {
  return { createWebSocketClient: vi.fn() }
})

vi.mock(import('#server/utils/config'), () => {
  return { getRuntimeDatabaseConfig: vi.fn() }
})

vi.mock(import('#server/utils/auth/password-recovery-persistence'), () => {
  return {
    issuePasswordRecovery: vi.fn(),
    revokePasswordRecoveryToken: vi.fn()
  }
})

const email = 'person@example.com'
const token = 'secret-reset-token'
const tokenHash = 'secret-token-hash'
const emailSendMock = vi.fn<(message: EmailMessage | EmailMessageBuilder) => Promise<EmailSendResult>>()
const actualDatabaseModule = await vi.importActual<{ createWebSocketClient: typeof createWebSocketClient; }>('#server/utils/database')

const databaseConfig = {
  databaseUrl: 'postgresql://test:test@localhost/test',
  isLocalDatabase: true
}

// oxlint-disable-next-line init-declarations -- A fresh pool is created for each test.
let database: ReturnType<typeof createWebSocketClient>

// oxlint-disable-next-line init-declarations -- The matching pool spy is created for each test.
let databaseEndSpy: MockInstance<() => Promise<void>>

const emailBinding: Env['EMAIL'] = {
  async send(message: EmailMessage | EmailMessageBuilder) {
    return emailSendMock(message)
  }
}

const options = {
  binding: emailBinding,

  config: {
    origin: 'https://metsik.app',
    stagingRecipient: null
  },

  databaseConfig,
  email,
  redirectTo: '/account',
  token,
  tokenHash
}

describe('password recovery background work', () => {
  beforeEach(() => {
    database = actualDatabaseModule.createWebSocketClient(databaseConfig)
    databaseEndSpy = vi.spyOn(database.$client, 'end')

    vi.mocked(createWebSocketClient).mockReturnValue(database)
    vi.mocked(getRuntimeDatabaseConfig).mockReturnValue(databaseConfig)

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected background diagnostics are asserted below.
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it('issues an allowed token and sends a text and HTML fragment link', async () => {
    vi.mocked(issuePasswordRecovery).mockResolvedValue(true)
    await runPasswordRecoveryIssuance(options)

    expect(issuePasswordRecovery).toHaveBeenCalledWith(database, {
      email,
      isRecipientAllowed: true,
      redirectTo: '/account',
      tokenHash
    })

    expect(emailSendMock).toHaveBeenCalledWith({
      from: 'noreply@metsik.app',
      to: email,
      subject: 'Reset your Metsik password',
      text: expect.stringContaining(`https://metsik.app/auth/reset-password?redirectTo=%2Faccount#token=${token}`) as unknown,
      html: expect.stringContaining(`https://metsik.app/auth/reset-password?redirectTo=%2Faccount#token=${token}`) as unknown
    })

    expect(databaseEndSpy).toHaveBeenCalledTimes(1)
  })

  it('marks a non-staging recipient as ineligible without changing the public background contract', async () => {
    vi.mocked(issuePasswordRecovery).mockResolvedValue(false)

    await expect(runPasswordRecoveryIssuance({
      ...options,

      config: {
        ...options.config,
        stagingRecipient: 'allowed@example.com'
      }
    })).resolves.toBeUndefined()

    expect(issuePasswordRecovery).toHaveBeenCalledWith(database, {
      email,
      isRecipientAllowed: false,
      redirectTo: '/account',
      tokenHash
    })

    expect(emailSendMock).not.toHaveBeenCalled()
  })

  it('compensates a provider rejection, redacts every token value, and still closes the database', async () => {
    vi.mocked(issuePasswordRecovery).mockResolvedValue(true)
    emailSendMock.mockRejectedValue(new Error(`Rejected ${email} ${token} ${tokenHash}`))
    await expect(runPasswordRecoveryIssuance(options)).resolves.toBeUndefined()

    expect(revokePasswordRecoveryToken).toHaveBeenCalledWith(database, {
      email,
      tokenHash
    })

    expect(databaseEndSpy).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith('Password recovery request failed', expect.any(Object))

    const diagnostics = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(diagnostics).not.toContain(email)
    expect(diagnostics).not.toContain(token)
    expect(diagnostics).not.toContain(tokenHash)
    expect(diagnostics).toContain('[REDACTED]')
  })

  it('owns and redacts a database close rejection without rejecting background work', async () => {
    vi.mocked(issuePasswordRecovery).mockResolvedValue(false)
    databaseEndSpy.mockRejectedValue(new Error(`Close failed for ${email} ${tokenHash}`))
    await expect(runPasswordRecoveryIssuance(options)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith('Password recovery database close failed', expect.any(Object))

    const diagnostics = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(diagnostics).not.toContain(email)
    expect(diagnostics).not.toContain(tokenHash)
    expect(diagnostics).toContain('[REDACTED]')
  })

  it('catches a synchronous database setup failure without creating a rejected background promise', async () => {
    vi.mocked(createWebSocketClient).mockImplementationOnce(() => {
      throw new Error(`Could not connect for ${email} with ${token}`)
    })

    await expect(runPasswordRecoveryIssuance(options)).resolves.toBeUndefined()
    expect(databaseEndSpy).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith('Password recovery request failed', expect.any(Object))

    const diagnostics = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(diagnostics).not.toContain(email)
    expect(diagnostics).not.toContain(token)
    expect(diagnostics).toContain('[REDACTED]')
  })
})

describe('password recovery email', () => {
  it('escapes the fragment link in HTML while preserving the plaintext URL', async () => {
    const send = vi.fn<(message: EmailMessage | EmailMessageBuilder) => Promise<EmailSendResult>>()

    const binding: Env['EMAIL'] = {
      async send(message: EmailMessage | EmailMessageBuilder) {
        return send(message)
      }
    }

    await sendPasswordRecoveryEmail(binding, {
      origin: 'https://metsik.app',
      stagingRecipient: null
    }, {
      email,
      redirectTo: '/account',
      token: 'a&b'
    })

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('#token=a%26b') as unknown,
      html: expect.stringContaining('#token=a%26b') as unknown
    }) as unknown)
  })
})

describe(withPasswordRecoveryDatabase, () => {
  beforeEach(() => {
    database = actualDatabaseModule.createWebSocketClient(databaseConfig)
    databaseEndSpy = vi.spyOn(database.$client, 'end')

    vi.mocked(createWebSocketClient).mockReturnValue(database)
    vi.mocked(getRuntimeDatabaseConfig).mockReturnValue(databaseConfig)

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected reset diagnostics are asserted below.
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it('preserves safe client errors and closes the database', async () => {
    const event = createTestEvent({})

    const result = withPasswordRecoveryDatabase(event, ['secret-token'], async () => {
      await Promise.reject(createError({
        status: 400,
        statusMessage: 'The password reset link is invalid or expired'
      }))
    })

    await expect(result).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'The password reset link is invalid or expired'
    })

    expect(databaseEndSpy).toHaveBeenCalledTimes(1)
  })

  it('redacts unexpected database failures, maps them to 503, and closes the database', async () => {
    const event = createTestEvent({})
    const secret = 'secret-token'

    const result = withPasswordRecoveryDatabase(event, [secret], async () => {
      await Promise.reject(new Error(`Query failed for ${secret}`))
    })

    await expect(result).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'Password recovery is temporarily unavailable. Try again'
    })

    expect(databaseEndSpy).toHaveBeenCalledTimes(1)

    const diagnostics = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(diagnostics).not.toContain(secret)
    expect(diagnostics).toContain('[REDACTED]')
  })
})
