import { createError, type H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import type { OAuthProvider } from '#shared/types/oauth'
import { clearAppSession, useAppSession } from '#server/utils/session'
import { oauthAccounts, oauthProviders, users } from '#server/database/schema'

interface SessionUser {
  readonly userId: string | null;
  readonly isAdmin: boolean;
  readonly isGuest: boolean;
}

const defaultUser : SessionUser = {
  userId: null,
  isAdmin: false,
  isGuest: false
}

async function getSessionUser(event: H3Event) : Promise<SessionUser> {
  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    return defaultUser
  }

  // Check if the user in database
  const foundUser = await event.context.dbHttp.query.users
    .findFirst({
      columns: {
        id: true,
        isAdmin: true
      },

      where: {
        id: userId
      },

      with: {
        oauthAccounts: {
          columns: {
            id: true
          },

          limit: 1
        }
      }
    })

  if (foundUser?.id === undefined) {
    await clearAppSession(event)

    return defaultUser
  }

  const isGuest = foundUser.oauthAccounts.length === 0

  return {
    userId: foundUser.id,
    isAdmin: foundUser.isAdmin,
    isGuest
  }
}

async function getUserByOAuthAccount(
  provider: OAuthProvider,
  accountId: string,
  event: H3Event
) : Promise<SessionUser> {
  const [foundUser] = await event.context.dbHttp
    .select({
      userId: oauthAccounts.userId,
      isAdmin: users.isAdmin
    })
    .from(oauthAccounts)
    .innerJoin(
      oauthProviders,

      and(
        eq(oauthProviders.id, oauthAccounts.providerId),
        eq(oauthProviders.type, provider)
      )
    )
    .innerJoin(
      users,
      eq(users.id, oauthAccounts.userId)
    )
    .where(
      eq(oauthAccounts.accountId, accountId)
    )

  if (foundUser === undefined) {
    return defaultUser
  }

  return {
    userId: foundUser.userId,
    isAdmin: foundUser.isAdmin,
    isGuest: false
  }
}

async function validateRegisteredUser(event: H3Event): Promise<string> {
  const user = await getSessionUser(event)

  if (user.userId === null) {
    throw createError({ status: 401 })
  }

  if (user.isGuest) {
    throw createError({ status: 403 })
  }

  return user.userId
}

export { getSessionUser, getUserByOAuthAccount, validateRegisteredUser }
export type { SessionUser }
