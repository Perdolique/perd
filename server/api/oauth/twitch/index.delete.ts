import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { getSessionUser } from '#server/utils/user'
import { unlinkOAuthAccount } from '#server/utils/oauth/account'
import { getTwitchDisconnectError } from '#server/utils/oauth/twitch-state'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'

interface TwitchDisconnectResponse {
  isTwitchLinked: false;
}

export default defineEventHandler(async (event): Promise<TwitchDisconnectResponse> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const sensitiveValues: string[] = []

  try {
    const user = await getSessionUser(event)

    if (user.userId === null) {
      throw createError({
        status: 401,
        statusMessage: twitchOAuthMessages.disconnectSignInRequired
      })
    }

    sensitiveValues.push(user.userId)

    if (user.isTwitchLinked === false) {
      return { isTwitchLinked: false }
    }

    if (user.email === null) {
      throw createError({
        status: 409,
        statusMessage: twitchOAuthMessages.disconnectEmailRequired
      })
    }

    await unlinkOAuthAccount(event, {
      provider: 'twitch',
      userId: user.userId
    })

    return { isTwitchLinked: false }
  } catch (error) {
    throw getTwitchDisconnectError(error, sensitiveValues)
  }
})
