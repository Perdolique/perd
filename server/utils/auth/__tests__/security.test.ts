import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { DrizzleQueryError } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateEmailAuthenticationOrigin, validateEmailRegistrationConfig } from '../email-registration-config'
import { enforceRegistrationRateLimit } from '../email-registration-request'
import { sendRegistrationEmail } from '../email-registration-mail'
import { getAuthErrorDetails } from '../telemetry'
import { isEmailRegistrationEnabled } from '#shared/utils/email-registration'

function createRequestEvent(bindings: Record<string, unknown>) {
  const request = new IncomingMessage(new Socket())
  const event = createEvent(request, new ServerResponse(request))

  Reflect.set(event.context, 'cloudflare', { env: bindings })

  return event
}

describe('email registration security configuration', () => {
  it.each([false, 'false', '', undefined, '1', 1])('should default the registration feature to disabled for %s', (value) => {
    expect(isEmailRegistrationEnabled(value)).toBe(false)
  })

  it.each([true, 'true'])('should enable registration only for %s', (value) => {
    expect(isEmailRegistrationEnabled(value)).toBe(true)
  })

  it.each([
    {
      environment: 'staging',
      origin: 'https://staging.metsik.app',
      stagingRecipient: ''
    },
    {
      environment: 'production',
      origin: 'http://metsik.app',
      stagingRecipient: ''
    },
    {
      environment: 'staging',
      origin: 'https://staging.metsik.app/path',
      stagingRecipient: 'one@example.com'
    },
    {
      environment: '',
      origin: 'https://metsik.app',
      stagingRecipient: ''
    }
  ])('should reject incomplete or unsafe launch configuration %s', (settings) => {
    expect(() => validateEmailRegistrationConfig(settings)).toThrow('Email registration is not configured')
  })

  it('should enforce the configured staging address without changing it to a different recipient', () => {
    expect(validateEmailRegistrationConfig({
      environment: 'staging',
      origin: 'https://staging.metsik.app',
      stagingRecipient: 'One.Trip+test@Example.com'
    })).toStrictEqual({
      origin: 'https://staging.metsik.app',
      stagingRecipient: 'one.trip+test@example.com'
    })
  })

  it('should allow sign-in origin validation without a staging registration recipient', () => {
    expect(validateEmailAuthenticationOrigin({
      environment: 'staging',
      origin: 'https://staging.metsik.app',
      stagingRecipient: ''
    })).toBe('https://staging.metsik.app')
  })
})

describe('registration rate limiting', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['EMAIL_REGISTRATION_RATE_LIMITER', 'EMAIL_VERIFICATION_RATE_LIMITER'] as const)('should check independent IP and subject keys in %s', async (bindingName) => {
    const limit = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false })
    const event = createRequestEvent({ [bindingName]: { limit } })

    await expect(enforceRegistrationRateLimit(event, bindingName, ['ip:203.0.113.1', 'subject:hash'])).rejects.toMatchObject({ statusCode: 429 })
    expect(limit.mock.calls).toStrictEqual([[{ key: 'ip:203.0.113.1' }], [{ key: 'subject:hash' }]])
    expect(event.node.res.getHeader('Retry-After')).toBe(60)
  })

  it('should fail closed when a binding is unavailable while retaining safe diagnostics', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {
      // Keep expected provider failure diagnostics out of the runner output.
    })

    const limit = vi.fn().mockRejectedValue(new Error('Provider unavailable for ip:203.0.113.1 subject:secret'))
    const event = createRequestEvent({ EMAIL_REGISTRATION_RATE_LIMITER: { limit } })

    await expect(enforceRegistrationRateLimit(event, 'EMAIL_REGISTRATION_RATE_LIMITER', ['ip:203.0.113.1', 'subject:secret'])).rejects.toMatchObject({ statusCode: 503 })

    const diagnostics = JSON.stringify(log.mock.calls)

    expect(diagnostics).toContain('Provider unavailable')
    expect(diagnostics).not.toContain('203.0.113.1')
    expect(diagnostics).not.toContain('subject:secret')
  })
})

describe('registration mail and telemetry', () => {
  it('should send both text and HTML with a fragment-only token from the configured origin', async () => {
    const send = vi.fn(async () => {
      // Simulated mail delivery.
    })

    const event = createRequestEvent({ EMAIL: { send } })

    await sendRegistrationEmail(event, {
      origin: 'https://staging.metsik.app',
      stagingRecipient: 'trip@example.com'
    }, {
      email: 'trip@example.com',
      token: 'verification-token',
      isExistingAccount: false
    })

    expect(send).toHaveBeenCalledExactlyOnceWith({
      from: 'noreply@metsik.app',
      to: 'trip@example.com',
      subject: 'Verify your Metsik email',
      text: expect.stringContaining('https://staging.metsik.app/auth/verify-email#token=verification-token') as unknown,
      html: expect.stringContaining('href="https://staging.metsik.app/auth/verify-email#token=verification-token"') as unknown
    })
  })

  it('should notify existing accounts without including an activation link', async () => {
    const send = vi.fn(async () => {
      // Simulated mail delivery.
    })

    await sendRegistrationEmail(createRequestEvent({ EMAIL: { send } }), {
      origin: 'https://metsik.app',
      stagingRecipient: null
    }, {
      email: 'trip@example.com',
      token: 'verification-token',
      isExistingAccount: true
    })

    const delivered = JSON.stringify(send.mock.calls)

    expect(delivered).toContain('already belongs to a Metsik account')
    expect(delivered).not.toContain('verification-token')
    expect(delivered).not.toContain('verify-email')
  })

  it('should strip SQL and parameters while retaining the redacted provider cause', () => {
    const error = new DrizzleQueryError('INSERT INTO credentials VALUES ($1)', ['password-hash'], new Error('Database unavailable: secret-token'))
    const details = getAuthErrorDetails(error, ['secret-token'])
    const serialized = JSON.stringify(details)

    expect(serialized).toContain('Database unavailable')
    expect(serialized).toContain('[REDACTED]')
    expect(serialized).not.toContain('secret-token')
    expect(serialized).not.toContain('password-hash')
    expect(serialized).not.toContain('INSERT INTO')
  })
})
