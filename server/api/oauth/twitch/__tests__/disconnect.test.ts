import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import disconnectTwitchHandler from '#server/api/oauth/twitch/index.delete'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { getSessionUserMock, unlinkOAuthAccountMock } = vi.hoisted(() => {
  return {
    getSessionUserMock: vi.fn(),
    unlinkOAuthAccountMock: vi.fn<() => Promise<void>>()
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    getSessionUser: getSessionUserMock
  }
})

vi.mock(import('#server/utils/oauth/account'), () => {
  return {
    unlinkOAuthAccount: unlinkOAuthAccountMock
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    useAppSession: vi.fn()
  }
})

describe('delete /api/oauth/twitch', () => {
  const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477bb'

  beforeEach(() => {
    getSessionUserMock.mockResolvedValue({
      email: 'trip@example.com',
      isAdmin: false,
      isGuest: false,
      isTwitchLinked: true,
      userId
    })

    unlinkOAuthAccountMock.mockResolvedValue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('disconnects Twitch from the current email account', async () => {
    const event = createTestEvent({})

    await expect(disconnectTwitchHandler(event)).resolves.toStrictEqual({
      isTwitchLinked: false
    })

    expect(unlinkOAuthAccountMock).toHaveBeenCalledWith(event, {
      provider: 'twitch',
      userId
    })

    expect(event.node.res.getHeader('Cache-Control')).toBe('no-store')
  })

  it('treats an already disconnected account as an idempotent success', async () => {
    getSessionUserMock.mockResolvedValue({
      email: 'trip@example.com',
      isAdmin: false,
      isGuest: false,
      isTwitchLinked: false,
      userId
    })

    await expect(disconnectTwitchHandler(createTestEvent({}))).resolves.toStrictEqual({
      isTwitchLinked: false
    })

    expect(unlinkOAuthAccountMock).not.toHaveBeenCalled()
  })

  it('requires a signed-in user', async () => {
    getSessionUserMock.mockResolvedValue({
      email: null,
      isAdmin: false,
      isGuest: false,
      isTwitchLinked: false,
      userId: null
    })

    await expect(disconnectTwitchHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: twitchOAuthMessages.disconnectSignInRequired
    })

    expect(unlinkOAuthAccountMock).not.toHaveBeenCalled()
  })

  it('keeps Twitch connected until a verified email is added', async () => {
    getSessionUserMock.mockResolvedValue({
      email: null,
      isAdmin: false,
      isGuest: false,
      isTwitchLinked: true,
      userId
    })

    await expect(disconnectTwitchHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: twitchOAuthMessages.disconnectEmailRequired
    })

    expect(unlinkOAuthAccountMock).not.toHaveBeenCalled()
  })

  it('returns a safe error and redacts the user id from database telemetry', async () => {
    const databaseError = new Error(`Database failed for ${userId}`)

    unlinkOAuthAccountMock.mockRejectedValue(databaseError)

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected database failure is asserted below.
    })

    await expect(disconnectTwitchHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: twitchOAuthMessages.disconnectUnavailable
    })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).toContain('Database failed')
    expect(telemetry).not.toContain(userId)
  })
})
