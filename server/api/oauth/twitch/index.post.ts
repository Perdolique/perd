import { defineEventHandler, createError, readValidatedBody, setResponseHeader } from 'h3'
import { getUserByOAuthAccount } from '#server/utils/user'
import { createOAuthUser } from '#server/utils/oauth/account'
import { updateAppSession } from '#server/utils/session'
import { getTwitchOAuthToken, getTwitchUserInfo, getRuntimeTwitchConfig } from '#server/utils/oauth/twitch'
import { getTwitchOAuthActor, getTwitchOAuthError } from '#server/utils/oauth/twitch-state'
import { consumeTwitchOAuthState } from '#server/utils/oauth/twitch-state-persistence'
import { hashToken } from '#server/utils/auth/password'
import { validateTwitchOAuthBody } from '#server/utils/validation/schemas'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'

interface TwitchOAuthResponse {
  email: string | null;
  isAdmin: boolean;
  isGuest: boolean;
  userId: string;
  redirectTo: string;
}

export default defineEventHandler(async (event): Promise<TwitchOAuthResponse> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const sensitiveValues: string[] = []

  try {
    const body = await readValidatedBody(event, validateTwitchOAuthBody)
    const stateHash = hashToken(body.state)

    sensitiveValues.push(body.state, stateHash)

    if ('code' in body) {
      sensitiveValues.push(body.code)
    }

    const actor = await getTwitchOAuthActor(event)

    sensitiveValues.push(actor.sessionIdHash)

    const consumedAttempt = await consumeTwitchOAuthState(event.context.dbHttp, {
      actor,
      stateHash
    })

    if ('error' in body) {
      if (body.error === 'access_denied') {
        throw createError({
          status: 400,
          statusMessage: twitchOAuthMessages.cancelled
        })
      }

      throw new Error(`Twitch authorization failed: ${body.error}`)
    }

    if (consumedAttempt.intent === 'link') {
      // Account linking is implemented separately in #104.
      throw createError({
        status: 501,
        statusMessage: twitchOAuthMessages.linkingUnavailable
      })
    }

    const twitchConfig = getRuntimeTwitchConfig(event)

    sensitiveValues.push(twitchConfig.clientSecret)

    const token = await getTwitchOAuthToken(event, body.code, twitchConfig)

    sensitiveValues.push(token)

    const { id: twitchAccountId } = await getTwitchUserInfo(token, twitchConfig.clientId)
    const foundUser = await getUserByOAuthAccount('twitch', twitchAccountId, event)

    if (foundUser.userId === null) {
      const newUser = await createOAuthUser('twitch', twitchAccountId, event)

      await updateAppSession(event, newUser)

      return {
        email: null,
        isAdmin: newUser.isAdmin,
        isGuest: newUser.isGuest,
        userId: newUser.userId,
        redirectTo: consumedAttempt.redirectTo
      }
    }

    await updateAppSession(event, { userId: foundUser.userId })

    return {
      email: foundUser.email,
      isAdmin: foundUser.isAdmin,
      isGuest: foundUser.isGuest,
      userId: foundUser.userId,
      redirectTo: consumedAttempt.redirectTo
    }
  } catch (error) {
    throw getTwitchOAuthError(error, sensitiveValues)
  }
})
