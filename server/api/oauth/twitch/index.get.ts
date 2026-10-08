import type { InferInput } from 'valibot'
import { createError, defineEventHandler, getValidatedQuery, sendRedirect, type RequestEvent } from 'nuxt/server'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { getTwitchRedirectUri, getRuntimeTwitchConfig } from '#server/utils/oauth/twitch'
import { validateTwitchOAuthQuery, type twitchOAuthQuerySchema } from '#server/utils/validation/schemas'
import { createVerificationToken, hashToken } from '#server/utils/auth/password'
import { getTwitchOAuthContext, getTwitchOAuthError } from '#server/utils/oauth/twitch-state'
import { issueTwitchOAuthState } from '#server/utils/oauth/twitch-state-persistence'
import { getTrustedClientIp, getTwitchOAuthRateLimiterBinding } from '#server/utils/cloudflare'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'

interface TwitchOAuthAuthorizationResponse {
  authorizationUrl: string;
}

async function enforceTwitchOAuthRateLimit(event: RequestEvent, clientIp: string): Promise<void> {
  const binding = getTwitchOAuthRateLimiterBinding(event)
  const outcome = await binding.limit({ key: clientIp })

  if (outcome.success === false) {
    event.res.headers.set('Retry-After', '60')

    throw createError({
      status: 429,
      statusText: twitchOAuthMessages.tooManyAttempts
    })
  }
}

export default defineEventHandler(async (event: ApiRequestEvent<{ query: InferInput<typeof twitchOAuthQuerySchema>; }>): Promise<TwitchOAuthAuthorizationResponse | string> => {
  event.res.headers.set('Cache-Control', 'no-store')

  const sensitiveValues: string[] = []

  try {
    const { redirectTo, intent, responseMode } = await getValidatedQuery(event, validateTwitchOAuthQuery)
    const twitchConfig = getRuntimeTwitchConfig()
    const clientIp = getTrustedClientIp(event, import.meta.dev === true)

    sensitiveValues.push(clientIp)
    await enforceTwitchOAuthRateLimit(event, clientIp)

    const { actor, user } = await getTwitchOAuthContext(event)

    if (intent === 'link' && actor.userId === null) {
      throw createError({
        status: 401,
        statusText: twitchOAuthMessages.signInRequired
      })
    }

    if (intent === 'sign-in' && actor.userId !== null) {
      throw createError({
        status: 409,
        statusText: twitchOAuthMessages.alreadySignedIn
      })
    }

    if (intent === 'link' && user.isTwitchLinked) {
      throw createError({
        status: 409,
        statusText: twitchOAuthMessages.alreadyLinked
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

    if (intent === 'link') {
      authUrl.searchParams.set('force_verify', 'true')
    }

    const twitchAuthUrl = authUrl.toString()

    if (responseMode === 'json') {
      return { authorizationUrl: twitchAuthUrl }
    }

    return sendRedirect(event, twitchAuthUrl)
  } catch (error) {
    throw getTwitchOAuthError(error, sensitiveValues)
  }
})
