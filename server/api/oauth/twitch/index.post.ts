import { defineEventHandler, createError, readValidatedBody, setResponseHeader } from 'h3'
import { getUserByOAuthAccount } from '#server/utils/user'
import { createOAuthUser, linkOAuthAccount } from '#server/utils/oauth/account'
import { updateAppSession } from '#server/utils/session'
import { getTwitchOAuthToken, getTwitchUserInfo, getRuntimeTwitchConfig } from '#server/utils/oauth/twitch'
import { getTwitchOAuthContext, getTwitchOAuthError } from '#server/utils/oauth/twitch-state'
import { consumeTwitchOAuthState } from '#server/utils/oauth/twitch-state-persistence'
import { hashToken } from '#server/utils/auth/password'
import { validateTwitchOAuthBody } from '#server/utils/validation/schemas'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'

interface TwitchOAuthResponse {
  email: string | null;
  isAdmin: boolean;
  isGuest: boolean;
  intent: 'sign-in' | 'link';
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

    const { actor, sessionVersion } = await getTwitchOAuthContext(event)

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

    const twitchConfig = getRuntimeTwitchConfig(event)

    sensitiveValues.push(twitchConfig.clientSecret)

    const token = await getTwitchOAuthToken(event, body.code, twitchConfig)

    sensitiveValues.push(token)

    const { id: twitchAccountId } = await getTwitchUserInfo(token, twitchConfig.clientId)

    sensitiveValues.push(twitchAccountId)

    if (consumedAttempt.intent === 'link') {
      const linkUserId = consumedAttempt.userId

      if (typeof linkUserId !== 'string') {
        throw createError({
          status: 400,
          statusMessage: twitchOAuthMessages.invalid
        })
      }

      const linkedUser = await linkOAuthAccount(event, {
        accountId: twitchAccountId,
        provider: 'twitch',
        sessionVersion,
        userId: linkUserId
      })

      return {
        email: linkedUser.email,
        isAdmin: linkedUser.isAdmin,
        isGuest: linkedUser.isGuest,
        intent: 'link',
        userId: linkedUser.userId,
        redirectTo: consumedAttempt.redirectTo
      }
    }

    const foundUser = await getUserByOAuthAccount('twitch', twitchAccountId, event)

    if (foundUser.userId === null) {
      const newUser = await createOAuthUser('twitch', twitchAccountId, event)

      await updateAppSession(event, newUser)

      return {
        email: null,
        isAdmin: newUser.isAdmin,
        isGuest: newUser.isGuest,
        intent: 'sign-in',
        userId: newUser.userId,
        redirectTo: consumedAttempt.redirectTo
      }
    }

    await updateAppSession(event, { userId: foundUser.userId })

    return {
      email: foundUser.email,
      isAdmin: foundUser.isAdmin,
      isGuest: foundUser.isGuest,
      intent: 'sign-in',
      userId: foundUser.userId,
      redirectTo: consumedAttempt.redirectTo
    }
  } catch (error) {
    throw getTwitchOAuthError(error, sensitiveValues)
  }
})
