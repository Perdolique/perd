import { createError, getRequestURL, useRuntimeConfig, type RequestEvent } from 'nuxt/server'
import { $fetch } from 'ofetch'
import { joinURL } from 'ufo'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { validateTwitchOAuthConfig } from './twitch-config'

interface TwitchUser {
  readonly id: string;
  readonly login: string;
  readonly display_name: string;
  readonly type: '' | 'staff' | 'admin' | 'global_mod';
  readonly broadcaster_type: '' | 'affiliate' | 'partner';
  readonly description: string;
  readonly profile_image_url: string;
  readonly offline_image_url: string;
  readonly created_at: string;

  // "user:read:email" scope required
  readonly email?: string;
}

interface TwitchOAuthTokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
  readonly refresh_token: string;
  readonly token_type: string;
  readonly scope?: string[];
}

interface TwitchUsersResponse {
  readonly data: TwitchUser[];
}

interface TwitchOAuthConfig {
  clientId: string;
  clientSecret: string;
}

function getRuntimeTwitchConfig(): TwitchOAuthConfig {
  const config = useRuntimeConfig()
  const twitchConfig = validateTwitchOAuthConfig(config.oauth.twitch)

  return twitchConfig
}

function getTwitchRedirectUri(event: RequestEvent): string {
  const url = getRequestURL(event)
  const redirectUri = joinURL(url.origin, '/auth/twitch')

  return redirectUri
}

async function getTwitchOAuthToken(event: RequestEvent, code: string, config: TwitchOAuthConfig): Promise<string> {
  try {
    const redirectUri = getTwitchRedirectUri(event)

    const tokenResponse = await $fetch<TwitchOAuthTokenResponse>('https://id.twitch.tv/oauth2/token', {
      method: 'POST',

      body: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }
    })

    return tokenResponse.access_token
  } catch (error) {
    const details = getAuthErrorDetails(error, [code, config.clientSecret])

    console.error('Twitch token exchange failed', { error: details })

    throw createError({
      status: 503,
      statusText: twitchOAuthMessages.unavailable
    })
  }
}

async function getTwitchUserInfo(accessToken: string, clientId: string): Promise<TwitchUser> {
  try {
    const usersResponse = await $fetch<TwitchUsersResponse>('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-ID': clientId
      }
    })

    if (usersResponse.data[0] === undefined) {
      throw new Error('No user data found')
    }

    return usersResponse.data[0]
  } catch (error) {
    const details = getAuthErrorDetails(error, [accessToken])

    console.error('Twitch user lookup failed', { error: details })

    throw createError({
      status: 503,
      statusText: twitchOAuthMessages.unavailable
    })
  }
}

export {
  getRuntimeTwitchConfig,
  getTwitchRedirectUri,
  getTwitchOAuthToken,
  getTwitchUserInfo
}
