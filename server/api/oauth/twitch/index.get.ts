import { defineEventHandler, getValidatedQuery, sendRedirect } from 'h3'
import { getTwitchRedirectUri, getRuntimeTwitchConfig } from '#server/utils/oauth/twitch'
import { validateRedirectTargetQuery } from '#server/utils/validation/schemas'

export default defineEventHandler(async (event) => {
  // TODO (#102): Check if the user is already logged in and linked their account
  // https://www.youtube.com/watch?v=dQw4w9WgXcQ

  const twitchConfig = getRuntimeTwitchConfig(event)
  const authUrl = new URL('https://id.twitch.tv/oauth2/authorize')
  const redirectUri = getTwitchRedirectUri(event)
  const { redirectTo } = await getValidatedQuery(event, validateRedirectTargetQuery)

  // Remaining gap (#103): replace redirect-only `state` with a CSRF-protecting nonce payload.
  // https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#use-the-authorization-code-to-get-a-token
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('client_id', twitchConfig.clientId)
  authUrl.searchParams.append('redirect_uri', redirectUri)
  authUrl.searchParams.append('state', redirectTo)

  const twitchAuthUrl = authUrl.toString()

  await sendRedirect(event, twitchAuthUrl)
})
