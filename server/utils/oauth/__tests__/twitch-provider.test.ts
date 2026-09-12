import { $fetch } from 'ofetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTwitchOAuthToken, getTwitchUserInfo } from '#server/utils/oauth/twitch'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { createTestEvent } from '~~/test-utils/create-test-event'

vi.mock(import('ofetch'), () => {
  const request = Object.assign(vi.fn(), {
    raw: vi.fn(),
    native: vi.fn(),
    create: vi.fn()
  })

  return { $fetch: request }
})

vi.mock(import('nitropack/runtime'), () => {
  return { useRuntimeConfig: vi.fn() }
})

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret'
}

describe('twitch provider requests', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected provider failures are asserted below.
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('exchanges the code server-side with the matching redirect URI', async () => {
    vi.mocked($fetch).mockResolvedValue({ access_token: 'access-token' })

    const event = createTestEvent({})

    event.node.req.headers.host = 'metsik.app'
    event.node.req.headers['x-forwarded-proto'] = 'https'

    await expect(getTwitchOAuthToken(event, 'oauth-code', config)).resolves.toBe('access-token')

    expect($fetch).toHaveBeenCalledWith('https://id.twitch.tv/oauth2/token', {
      method: 'POST',

      body: {
        client_id: 'client-id',
        client_secret: 'client-secret',
        code: 'oauth-code',
        grant_type: 'authorization_code',
        redirect_uri: 'https://metsik.app/auth/twitch'
      }
    })
  })

  it('preserves token failure diagnostics without logging the code or client secret', async () => {
    vi.mocked($fetch).mockRejectedValue(new Error('Token provider failed for oauth-code with client-secret'))

    await expect(getTwitchOAuthToken(createTestEvent({}), 'oauth-code', config)).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: twitchOAuthMessages.unavailable
    })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).toContain('Token provider failed')
    expect(telemetry).not.toContain('oauth-code')
    expect(telemetry).not.toContain('client-secret')
  })

  it('preserves user API diagnostics without logging the access token', async () => {
    vi.mocked($fetch).mockRejectedValue(new Error('User provider failed with private-access-token'))

    await expect(getTwitchUserInfo('private-access-token', 'client-id')).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: twitchOAuthMessages.unavailable
    })

    const telemetry = JSON.stringify(vi.mocked(console.error).mock.calls)

    expect(telemetry).toContain('User provider failed')
    expect(telemetry).not.toContain('private-access-token')
  })

  it('loads the Twitch profile with the access token and client ID headers', async () => {
    const twitchUser = {
      id: 'twitch-id',
      login: 'metsik',
      display_name: 'Metsik',
      type: '',
      broadcaster_type: '',
      description: '',
      profile_image_url: 'https://example.com/avatar.png',
      offline_image_url: '',
      created_at: '2026-09-12T00:00:00Z'
    }

    vi.mocked($fetch).mockResolvedValue({ data: [twitchUser] })
    await expect(getTwitchUserInfo('access-token', 'client-id')).resolves.toStrictEqual(twitchUser)

    expect($fetch).toHaveBeenCalledWith('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: 'Bearer access-token',
        'Client-ID': 'client-id'
      }
    })
  })

  it('rejects a successful response with no Twitch user', async () => {
    vi.mocked($fetch).mockResolvedValue({ data: [] })
    await expect(getTwitchUserInfo('access-token', 'client-id')).rejects.toMatchObject({ statusCode: 503 })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('No user data found')
  })
})
