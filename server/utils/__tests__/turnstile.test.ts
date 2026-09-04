import { createError, H3Error } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localTurnstileHostnames, turnstileAlwaysPassSecret } from '#shared/utils/turnstile'
import { validateTurnstileConfig } from '#server/utils/turnstile-config'
import { verifyGuestSessionTurnstile } from '#server/utils/turnstile'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { getRuntimeTurnstileConfigMock } = vi.hoisted(() => {
  return {
    getRuntimeTurnstileConfigMock: vi.fn()
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    getRuntimeTurnstileConfig: getRuntimeTurnstileConfigMock
  }
})

interface ConsoleErrorCall {
  readonly details: object;
  readonly message: unknown;
}

interface FetchCall {
  readonly options: RequestInit;
  readonly url: RequestInfo | URL;
}

const productionSecret = 'production-secret-value'
const productionHostname = 'metsik.app'
const token = 'turnstile-token-value'
const remoteIp = '203.0.113.20'
const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const fetchMock = vi.fn<typeof fetch>()

function setTurnstileConfig(secret = productionSecret, hostnames = productionHostname) {
  const config = validateTurnstileConfig({
    hostnames,
    secret
  })

  getRuntimeTurnstileConfigMock.mockReturnValue(config)
}

function mockSiteverifyResponse(body: unknown, status = 200) {
  const responseBody = JSON.stringify(body)

  fetchMock.mockResolvedValue(new Response(responseBody, { status }))
}

async function getVerificationError(
  options: { requestIp?: string; token?: unknown; } = {}
): Promise<H3Error> {
  const event = createTestEvent({})
  const submittedToken = Object.hasOwn(options, 'token') ? options.token : token
  const requestIp = options.requestIp ?? remoteIp

  try {
    await verifyGuestSessionTurnstile(event, submittedToken, requestIp)
  } catch (error) {
    if (error instanceof H3Error) {
      return error
    }

    throw error
  }

  throw new Error('Expected Turnstile verification to fail')
}

function getFetchCall(): FetchCall {
  const [call] = fetchMock.mock.calls

  if (call === undefined) {
    throw new TypeError('Expected one Siteverify request')
  }

  const [url, options] = call

  if (options === undefined) {
    throw new TypeError('Expected Siteverify request options')
  }

  return {
    options,
    url
  }
}

function getUrlSearchParams(body: BodyInit | null | undefined): URLSearchParams {
  if (!(body instanceof URLSearchParams)) {
    throw new TypeError('Expected a URLSearchParams request body')
  }

  return body
}

function getConsoleErrorCall(): ConsoleErrorCall {
  const call: unknown = vi.mocked(console.error).mock.calls[0]

  if (!Array.isArray(call)) {
    throw new TypeError('Expected a console error call')
  }

  const callValues = call.map((value: unknown) => value)
  const [message, details] = callValues

  if (details === null || typeof details !== 'object') {
    throw new TypeError('Expected structured console error details')
  }

  return {
    details,
    message
  }
}

describe(verifyGuestSessionTurnstile, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected verifier failures are asserted through structured telemetry.
    })

    setTurnstileConfig()

    mockSiteverifyResponse({
      action: 'guest_session',
      'error-codes': [],
      hostname: productionHostname,
      success: true
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each([
    {
      state: 'missing',
      value: undefined
    },
    {
      state: 'null',
      value: null
    },
    {
      state: 'numeric',
      value: 42
    },
    {
      state: 'empty',
      value: ''
    },
    {
      state: 'blank',
      value: '   '
    },
    {
      state: 'over 2048 characters',
      value: 'a'.repeat(2049)
    }
  ])('should reject a $state token before calling Siteverify', async ({ value }) => {
    const error = await getVerificationError({ token: value })

    expect(error.statusCode).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should send a bounded URL-encoded Siteverify request with the remote IP', async () => {
    const timeoutSignal = new AbortController().signal
    const timeoutMock = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal)
    const encodedToken = `${token}+&=`
    const encodedSecret = `${productionSecret}+/=`
    const ipv6Address = '2001:db8::20'

    setTurnstileConfig(encodedSecret)

    await verifyGuestSessionTurnstile(createTestEvent({}), encodedToken, ipv6Address)

    expect(timeoutMock).toHaveBeenCalledWith(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const { options, url } = getFetchCall()

    expect(url).toBe(siteverifyUrl)
    expect(options.method).toBe('POST')

    expect(options.headers).toStrictEqual({
      'Content-Type': 'application/x-www-form-urlencoded'
    })

    expect(options.signal).toBe(timeoutSignal)

    const requestBody = getUrlSearchParams(options.body)

    expect(requestBody.toString()).toBe(new URLSearchParams({
      secret: encodedSecret,
      response: encodedToken,
      remoteip: ipv6Address
    }).toString())
  })

  it('should accept the maximum supported token length', async () => {
    await expect(
      verifyGuestSessionTurnstile(createTestEvent({}), 'a'.repeat(2048), remoteIp)
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['', '   '])('should fail closed for a missing remote IP', async (requestIp) => {
    const error = await getVerificationError({ requestIp })

    expect(error.statusCode).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'failed verification',

      response: {
        'error-codes': ['invalid-input-response'],
        success: false
      }
    },
    {
      name: 'wrong action',

      response: {
        action: 'login',
        'error-codes': [],
        hostname: productionHostname,
        success: true
      }
    },
    {
      name: 'wrong hostname',

      response: {
        action: 'guest_session',
        'error-codes': [],
        hostname: 'attacker.example',
        success: true
      }
    }
  ])('should reject a valid response with $name', async ({ response }) => {
    mockSiteverifyResponse(response)

    const error = await getVerificationError()

    expect(error.statusCode).toBe(403)
  })

  it('should reject an expired or replayed token', async () => {
    mockSiteverifyResponse({
      'error-codes': ['timeout-or-duplicate'],
      success: false
    })

    const error = await getVerificationError()

    expect(error.statusCode).toBe(403)
  })

  it.each([
    'bad-request',
    'internal-error',
    'invalid-input-secret',
    'missing-input-secret'
  ])('should fail closed when Siteverify reports %s', async (errorCode) => {
    mockSiteverifyResponse({
      'error-codes': [errorCode],
      success: false
    })

    const error = await getVerificationError()

    expect(error.statusCode).toBe(503)
  })

  it.each([
    {
      config: {},
      state: 'missing values'
    },
    {
      config: {
        hostnames: productionHostname,
        secret: ''
      },

      state: 'empty secret'
    },
    {
      config: {
        hostnames: '',
        secret: productionSecret
      },

      state: 'empty hostname allowlist'
    }
  ])('should fail closed for $state', ({ config }) => {
    expect(() => validateTurnstileConfig(config)).toThrow(
      expect.objectContaining({ statusCode: 503 })
    )
  })

  it('should fail closed when runtime configuration is unavailable', async () => {
    const configError = createError({ status: 503 })

    getRuntimeTurnstileConfigMock.mockImplementation(() => {
      throw configError
    })

    const error = await getVerificationError()

    expect(error.statusCode).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should allow the official test secret only with local hostnames', async () => {
    setTurnstileConfig(turnstileAlwaysPassSecret, localTurnstileHostnames.join(','))

    mockSiteverifyResponse({
      action: 'test',
      'error-codes': [],
      hostname: 'localhost',
      success: true
    })

    await expect(
      verifyGuestSessionTurnstile(createTestEvent({}), token, remoteIp)
    ).resolves.toBeUndefined()
  })

  it('should reject the official test secret with a deployed hostname', () => {
    expect(() => {
      validateTurnstileConfig({
        hostnames: productionHostname,
        secret: turnstileAlwaysPassSecret
      })
    }).toThrow(expect.objectContaining({ statusCode: 503 }))
  })

  it('should preserve a network error in telemetry without logging credentials', async () => {
    const networkError = new Error(
      `Connection reset for ${token} using ${productionSecret}`
    )

    fetchMock.mockRejectedValue(networkError)

    const error = await getVerificationError()

    expect(error.statusCode).toBe(503)

    expect(console.error).toHaveBeenCalledTimes(1)

    const { details, message } = getConsoleErrorCall()
    const loggedError: unknown = Reflect.get(details, 'error')

    expect(message).toBe('Turnstile Siteverify request failed')

    expect(loggedError).toMatchObject({
      message: 'Connection reset for [REDACTED] using [REDACTED]',
      name: 'Error'
    })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).not.toContain(token)
    expect(telemetry).not.toContain(productionSecret)
  })

  it('should fail closed on a non-successful Siteverify response', async () => {
    mockSiteverifyResponse({ success: true }, 502)

    const error = await getVerificationError()

    expect(error.statusCode).toBe(503)

    expect(console.error).toHaveBeenCalledWith(
      'Turnstile Siteverify returned an unsuccessful status',
      { status: 502 }
    )
  })

  it('should fail closed on a non-JSON Siteverify response', async () => {
    const tokenPrefix = token.slice(0, 12)
    const secretPrefix = productionSecret.slice(0, 12)

    fetchMock.mockResolvedValue(new Response(`${tokenPrefix} ${secretPrefix}`))

    const error = await getVerificationError()

    expect(error.statusCode).toBe(503)
    expect(console.error).toHaveBeenCalledTimes(1)

    const { details, message } = getConsoleErrorCall()
    const loggedError: unknown = Reflect.get(details, 'error')

    expect(message).toBe('Turnstile Siteverify returned non-JSON data')
    expect(loggedError).toStrictEqual({ name: 'InvalidJsonResponse' })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).not.toContain(tokenPrefix)
    expect(telemetry).not.toContain(secretPrefix)
  })

  it('should fail closed on an invalid Siteverify response', async () => {
    mockSiteverifyResponse({
      action: productionSecret,
      success: token
    })

    const error = await getVerificationError()

    expect(error.statusCode).toBe(503)
    expect(console.error).toHaveBeenCalledTimes(1)

    const { details, message } = getConsoleErrorCall()
    const issues: unknown = Reflect.get(details, 'issues')

    expect(message).toBe('Turnstile Siteverify returned an invalid response')
    expect(Array.isArray(issues)).toBe(true)

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).not.toContain(token)
    expect(telemetry).not.toContain(productionSecret)
  })

  it('should log only the parsed Siteverify fields on rejection', async () => {
    mockSiteverifyResponse({
      action: 'login',
      cdata: token,
      'error-codes': ['invalid-input-response'],
      hostname: 'attacker.example',

      metadata: {
        secret: productionSecret
      },

      success: false
    })

    await getVerificationError()

    expect(console.error).toHaveBeenCalledWith(
      'Turnstile Siteverify rejected a Guest session',
      {
        response: {
          action: 'login',
          errorCodes: ['invalid-input-response'],
          hostname: 'attacker.example',
          success: false
        }
      }
    )

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).not.toContain(token)
    expect(telemetry).not.toContain(productionSecret)
  })
})
