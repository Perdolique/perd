import * as v from 'valibot'
import { defineEventHandler, createError, readValidatedBody } from 'h3'
import { getSessionUser, getUserByOAuthAccount } from '#server/utils/user'
import { createOAuthUser } from '#server/utils/oauth/account'
import { updateAppSession } from '#server/utils/session'
import { getTwitchOAuthToken, getTwitchUserInfo, getRuntimeTwitchConfig } from '#server/utils/oauth/twitch'

const bodySchema = v.object({
  code: v.pipe(v.string(), v.nonEmpty())
})
function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const twitchConfig = getRuntimeTwitchConfig(event)

  const { code } = await readValidatedBody(event, validateBody)
  const token = await getTwitchOAuthToken(event, code, twitchConfig)
  const { id: twitchAccountId } = await getTwitchUserInfo(token, twitchConfig.clientId)
  const currentUser = await getSessionUser(event)

  // Not logged in
  if (currentUser.userId === null) {
    const foundUser = await getUserByOAuthAccount('twitch', twitchAccountId, event)

    // Twitch account not linked to any user
    if (foundUser.userId === null) {
      // Create a new user with the OAuth account
      const newUser = await createOAuthUser('twitch', twitchAccountId, event)

      await updateAppSession(event, newUser)

      return newUser
    }

    // User already linked their Twitch account
    await updateAppSession(event, {
      userId: foundUser.userId,
      isAdmin: foundUser.isAdmin
    })

    return foundUser
  }

  // TODO (#104): Link the Twitch account to the current user

  throw createError({
    message: 'Not implemented',
    status: 501
  })
})
