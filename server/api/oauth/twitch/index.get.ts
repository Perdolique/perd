import { consola } from 'consola'

export default defineEventHandler(async (event) => {
  // TODO (#102): Check if the user is already logged in and linked their account
  // https://www.youtube.com/watch?v=dQw4w9WgXcQ

  const { OAUTH_TWITCH_CLIENT_ID } = process.env

  if (OAUTH_TWITCH_CLIENT_ID === undefined) {
    consola.error('OAUTH_TWITCH_CLIENT_ID is not defined')

    throw createError({
      statusCode: 500,
      message: 'Internal server error',
    })
  }

  const authUrl = new URL('https://id.twitch.tv/oauth2/authorize')
  const redirectUri = getTwitchRedirectUri(event)

  // TODO (#103): Add `state` to prevent CSRF attacks
  // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#use-the-authorization-code-to-get-a-token
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('client_id', OAUTH_TWITCH_CLIENT_ID)
  authUrl.searchParams.append('redirect_uri', redirectUri)

  const twitchAuthUrl = authUrl.toString()

  sendRedirect(event, twitchAuthUrl)
})
