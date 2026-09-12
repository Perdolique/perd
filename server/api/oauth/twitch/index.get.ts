import { createError, defineEventHandler, getValidatedQuery, sendRedirect, setResponseHeader, type H3Event } from 'h3'
import { getTwitchRedirectUri, getRuntimeTwitchConfig } from '#server/utils/oauth/twitch'
import { validateTwitchOAuthQuery } from '#server/utils/validation/schemas'
import { createVerificationToken, hashToken } from '#server/utils/auth/password'
import { getTwitchOAuthActor, getTwitchOAuthError } from '#server/utils/oauth/twitch-state'
import { issueTwitchOAuthState } from '#server/utils/oauth/twitch-state-persistence'
import { getGuestClientIp, getTwitchOAuthRateLimiterBinding } from '#server/utils/cloudflare'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'

async function enforceTwitchOAuthRateLimit(event: H3Event, clientIp: string): Promise<void> {
  const binding = getTwitchOAuthRateLimiterBinding(event)
  const outcome = await binding.limit({ key: clientIp })

  if (outcome.success === false) {
    setResponseHeader(event, 'Retry-After', 60)

    throw createError({
      status: 429,
      statusMessage: twitchOAuthMessages.tooManyAttempts
    })
  }
}

export default defineEventHandler(async (event): Promise<void> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const sensitiveValues: string[] = []

  try {
    const { redirectTo, intent } = await getValidatedQuery(event, validateTwitchOAuthQuery)
    const twitchConfig = getRuntimeTwitchConfig(event)
    const clientIp = getGuestClientIp(event, import.meta.dev === true)

    sensitiveValues.push(clientIp)
    await enforceTwitchOAuthRateLimit(event, clientIp)

    const actor = await getTwitchOAuthActor(event)

    if (intent === 'link' && actor.userId === null) {
      throw createError({
        status: 401,
        statusMessage: twitchOAuthMessages.signInRequired
      })
    }

    if (intent === 'sign-in' && actor.userId !== null) {
      throw createError({
        status: 409,
        statusMessage: twitchOAuthMessages.alreadySignedIn
      })
    }

    const state = createVerificationToken()
    const stateHash = hashToken(state)

    sensitiveValues.push(state, stateHash, actor.sessionIdHash, twitchConfig.clientSecret)

    await issueTwitchOAuthState(event.context.dbHttp, {
      actor,
      stateHash,
      intent,
      redirectTo
    })

    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize')
    const redirectUri = getTwitchRedirectUri(event)

    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', twitchConfig.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)

    const twitchAuthUrl = authUrl.toString()

    await sendRedirect(event, twitchAuthUrl)
  } catch (error) {
    throw getTwitchOAuthError(error, sensitiveValues)
  }
})
