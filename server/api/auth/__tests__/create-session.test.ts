import type * as h3 from 'h3'
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { turnstileResponseFieldName } from '#shared/utils/turnstile'
import createGuestSessionHandler from '#server/api/auth/create-session.post'
import { users } from '#server/database/schema'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getGuestSessionRateLimiterBindingMock,
  getSessionUserMock,
  readBodyMock,
  sessionUpdateMock,
  setResponseHeaderMock,
  setResponseStatusMock,
  useAppSessionMock,
  verifyGuestSessionTurnstileMock
} = vi.hoisted(() => {
  return {
    getGuestSessionRateLimiterBindingMock: vi.fn(),
    getSessionUserMock: vi.fn(),
    readBodyMock: vi.fn(),
    sessionUpdateMock: vi.fn(),
    setResponseHeaderMock: vi.fn<typeof h3.setResponseHeader>(),
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    useAppSessionMock: vi.fn(),
    verifyGuestSessionTurnstileMock: vi.fn()
  }
})

vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,
    readBody: readBodyMock,
    setResponseHeader: setResponseHeaderMock,
    setResponseStatus: setResponseStatusMock
  }
})

vi.mock(import('#server/utils/cloudflare'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    getGuestSessionRateLimiterBinding: getGuestSessionRateLimiterBindingMock
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    useAppSession: useAppSessionMock
  }
})

vi.mock(import('#server/utils/turnstile'), () => {
  return {
    verifyGuestSessionTurnstile: verifyGuestSessionTurnstileMock
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    getSessionUser: getSessionUserMock
  }
})

const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const guestSessionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'
const clientIp = '203.0.113.20'
const turnstileToken = 'turnstile-token-value'
const rateLimitMock = vi.fn<Env['GUEST_SESSION_RATE_LIMITER']['limit']>()

function createGuestEvent(dbHttp: unknown) {
  const event = createTestEvent(dbHttp)

  event.node.req.headers['cf-connecting-ip'] = clientIp

  return event
}

function createInsertDb(
  insertResult = [{ userId }],
  existingGuestResult?: { id: string; }
) {
  const returningMock = vi.fn().mockResolvedValue(insertResult)

  const onConflictDoNothingMock = vi.fn(() => {
    return { returning: returningMock }
  })

  const valuesMock = vi.fn(() => {
    return { onConflictDoNothing: onConflictDoNothingMock }
  })

  const insertMock = vi.fn((table: unknown) => {
    expect(table).toBe(users)

    return { values: valuesMock }
  })

  const findFirstMock = vi.fn().mockResolvedValue(existingGuestResult)

  return {
    dbHttp: {
      insert: insertMock,

      query: {
        users: {
          findFirst: findFirstMock
        }
      }
    },

    findFirstMock,
    insertMock,
    onConflictDoNothingMock,
    returningMock,
    valuesMock
  }
}

describe('post /api/auth/create-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected failure telemetry is asserted through handler outcomes.
    })

    getGuestSessionRateLimiterBindingMock.mockReturnValue({ limit: rateLimitMock })

    getSessionUserMock.mockResolvedValue({
      isAdmin: false,
      isGuest: false,
      userId: null
    })

    rateLimitMock.mockResolvedValue({ success: true })

    readBodyMock.mockResolvedValue({
      [turnstileResponseFieldName]: turnstileToken
    })

    useAppSessionMock.mockResolvedValue({
      id: guestSessionId,
      update: sessionUpdateMock
    })

    verifyGuestSessionTurnstileMock.mockImplementation(() => {
      // Successful verification has no return value.
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should verify, rate-limit, create, and return a Guest account', async () => {
    const {
      dbHttp,
      findFirstMock,
      onConflictDoNothingMock,
      valuesMock
    } = createInsertDb()

    const event = createGuestEvent(dbHttp)
    const result = await createGuestSessionHandler(event)

    expect(readBodyMock).toHaveBeenCalledWith(event)

    expect(verifyGuestSessionTurnstileMock).toHaveBeenCalledWith(
      event,
      turnstileToken,
      clientIp
    )

    expect(rateLimitMock).toHaveBeenCalledWith({ key: clientIp })
    expect(valuesMock).toHaveBeenCalledWith({ guestSessionId })

    expect(onConflictDoNothingMock).toHaveBeenCalledWith({
      target: users.guestSessionId
    })

    expect(findFirstMock).not.toHaveBeenCalled()
    expect(sessionUpdateMock).toHaveBeenCalledWith({ userId })
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)

    expect(result).toStrictEqual({
      isGuest: true,
      userId
    })

    const [verifyOrder = Number.NaN] = verifyGuestSessionTurnstileMock.mock.invocationCallOrder
    const [rateLimitOrder = Number.NaN] = rateLimitMock.mock.invocationCallOrder
    const [databaseOrder = Number.NaN] = getSessionUserMock.mock.invocationCallOrder

    expect(verifyOrder).toBeLessThan(rateLimitOrder)
    expect(rateLimitOrder).toBeLessThan(databaseOrder)
  })

  it('should reuse the Guest created concurrently for the same session', async () => {
    const {
      dbHttp,
      findFirstMock,
      insertMock,
      valuesMock
    } = createInsertDb([], { id: userId })

    const event = createGuestEvent(dbHttp)
    const result = await createGuestSessionHandler(event)

    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(valuesMock).toHaveBeenCalledWith({ guestSessionId })

    expect(findFirstMock).toHaveBeenCalledWith({
      columns: {
        id: true
      },

      where: {
        guestSessionId
      }
    })

    expect(sessionUpdateMock).toHaveBeenCalledWith({ userId })
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 200)

    expect(result).toStrictEqual({
      isGuest: true,
      userId
    })
  })

  it('should fail closed without inserting when the session identity is unavailable', async () => {
    const { dbHttp, insertMock } = createInsertDb()
    const event = createGuestEvent(dbHttp)

    useAppSessionMock.mockResolvedValue({
      id: undefined,
      update: sessionUpdateMock
    })

    await expect(createGuestSessionHandler(event)).rejects.toMatchObject({
      statusCode: 503
    })

    expect(insertMock).not.toHaveBeenCalled()
    expect(sessionUpdateMock).not.toHaveBeenCalled()
  })

  it('should fail closed before verification when the client address is unavailable', async () => {
    const { dbHttp, insertMock } = createInsertDb()
    const event = createTestEvent(dbHttp)

    await expect(createGuestSessionHandler(event)).rejects.toMatchObject({
      statusCode: 503
    })

    expect(verifyGuestSessionTurnstileMock).not.toHaveBeenCalled()
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(useAppSessionMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      isGuest: true,
      kind: 'Guest'
    },
    {
      isGuest: false,
      kind: 'Twitch'
    }
  ])('should return an existing $kind user without inserting or updating the session', async ({ isGuest }) => {
    const { dbHttp, insertMock } = createInsertDb()
    const event = createGuestEvent(dbHttp)

    getSessionUserMock.mockResolvedValue({
      isAdmin: false,
      isGuest,
      userId
    })

    const result = await createGuestSessionHandler(event)

    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 200)
    expect(insertMock).not.toHaveBeenCalled()
    expect(useAppSessionMock).not.toHaveBeenCalled()
    expect(sessionUpdateMock).not.toHaveBeenCalled()

    expect(result).toStrictEqual({
      isGuest,
      userId
    })
  })

  it.each([
    {
      status: 403,
      state: 'invalid Turnstile token'
    },
    {
      status: 503,
      state: 'unavailable Turnstile verification'
    }
  ])('should make no database calls for $state', async ({ status }) => {
    const { dbHttp, insertMock } = createInsertDb()
    const event = createGuestEvent(dbHttp)
    const verificationError = createError({ status })

    verifyGuestSessionTurnstileMock.mockRejectedValue(verificationError)

    await expect(createGuestSessionHandler(event)).rejects.toMatchObject({
      statusCode: status
    })

    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(useAppSessionMock).not.toHaveBeenCalled()
  })

  it('should return 429 with Retry-After and make no database calls when limited', async () => {
    const { dbHttp, insertMock } = createInsertDb()
    const event = createGuestEvent(dbHttp)

    rateLimitMock.mockResolvedValue({ success: false })

    await expect(createGuestSessionHandler(event)).rejects.toMatchObject({
      statusCode: 429
    })

    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Retry-After', 60)
    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(useAppSessionMock).not.toHaveBeenCalled()
  })

  it('should return 503 and make no database calls for a missing binding', async () => {
    const { dbHttp, insertMock } = createInsertDb()
    const event = createGuestEvent(dbHttp)

    getGuestSessionRateLimiterBindingMock.mockImplementation(() => {
      throw createError({ status: 503 })
    })

    await expect(createGuestSessionHandler(event)).rejects.toMatchObject({
      statusCode: 503
    })

    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(useAppSessionMock).not.toHaveBeenCalled()
  })

  it('should return 503 and make no database calls for a binding failure', async () => {
    const { dbHttp, insertMock } = createInsertDb()
    const event = createGuestEvent(dbHttp)

    rateLimitMock.mockRejectedValue(new Error('Rate limiter unavailable'))

    await expect(createGuestSessionHandler(event)).rejects.toMatchObject({
      statusCode: 503
    })

    expect(getSessionUserMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(useAppSessionMock).not.toHaveBeenCalled()
  })
})
