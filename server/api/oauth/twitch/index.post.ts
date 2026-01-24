import * as v from 'valibot'
import { defineEventHandler, createError, readValidatedBody } from 'h3'
import { getSessionUser, getUserByOAuthAccount, createOAuthUser } from '#server/utils/user'
import { updateAppSession } from '#server/utils/session'
import { getTwitchOAuthToken, getTwitchUserInfo } from '#server/utils/provider-twitch'

const bodySchema = v.object({
  code: v.pipe(v.string(), v.nonEmpty())
})
function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { code } = await readValidatedBody(event, validateBody)
  const token = await getTwitchOAuthToken(event, code)
  const { id: twitchAccountId } = await getTwitchUserInfo(token)
  const currentUser = await getSessionUser(event)

  // Not logged in
  if (currentUser.userId === null) {
    const foundUser = await getUserByOAuthAccount(event, 'twitch', twitchAccountId)

    // Twitch account not linked to any user
    if (foundUser.userId === null) {
      // Create a new user with the OAuth account
      const newUser = await createOAuthUser('twitch', twitchAccountId)

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
