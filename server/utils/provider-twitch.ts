import { H3Event, createError, getRequestURL } from 'h3'
import consola from 'consola'
import { joinURL } from 'ufo'

import type {
  TwitchOAuthTokenResponse,
  TwitchUser,
  TwitchUsersResponse
} from '~/models/twitch'

export function getTwitchRedirectUri(event: H3Event) : string {
  const url = getRequestURL(event)
  const redirectUri = joinURL(url.origin, '/auth/twitch')

  return redirectUri
}

export async function getTwitchOAuthToken(event: H3Event, code: string) : Promise<string> {
  const {
    OAUTH_TWITCH_CLIENT_ID,
    OAUTH_TWITCH_CLIENT_SECRET
  } = process.env

  if (OAUTH_TWITCH_CLIENT_ID === undefined) {
    consola.error('OAUTH_TWITCH_CLIENT_ID is not defined')

    throw createError({
      status: 500,
      message: 'Internal server error',
    })
  }

  if (OAUTH_TWITCH_CLIENT_SECRET === undefined) {
    consola.error('OAUTH_TWITCH_CLIENT_SECRET is not defined')

    throw createError({
      status: 500,
      message: 'Internal server error',
    })
  }

  try {
    const redirectUri = getTwitchRedirectUri(event)

    const tokenResponse = await $fetch<TwitchOAuthTokenResponse>('https://id.twitch.tv/oauth2/token', {
      method: 'POST',

      body: {
        client_id: OAUTH_TWITCH_CLIENT_ID,
        client_secret: OAUTH_TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }
    })

    return tokenResponse.access_token
  } catch (error) {
    consola.error(error)

    throw createError({
      status: 400,
      message: 'Failed to obtain OAuth token',
    })
  }
}

export async function getTwitchUserInfo(accessToken: string) : Promise<TwitchUser> {
  const { OAUTH_TWITCH_CLIENT_ID } = process.env

  if (OAUTH_TWITCH_CLIENT_ID === undefined) {
    console.error('OAUTH_TWITCH_CLIENT_ID is not defined')

    throw createError({
      status: 500,
      message: 'Internal server error',
    })
  }

  try {
    const users = await $fetch<TwitchUsersResponse>('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-ID': OAUTH_TWITCH_CLIENT_ID
      }
    })

    if (users.data[0] === undefined) {
      throw new Error('No user data found')
    }

    return users.data[0]
  } catch (error) {
    consola.error(error)

    throw createError({
      status: 400,
      message: 'Failed to get user info',
    })
  }
}
