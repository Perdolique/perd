import { createError, type H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import type { OAuthProvider } from '#shared/types/oauth'
import { clearAppSession, useAppSession } from '#server/utils/session'
import { emailCredentials, oauthAccounts, oauthProviders, users } from '#server/database/schema'

interface SessionUser {
  readonly email: string | null;
  readonly userId: string | null;
  readonly isAdmin: boolean;
  readonly isGuest: boolean;
}

const defaultUser : SessionUser = {
  email: null,
  userId: null,
  isAdmin: false,
  isGuest: false
}

async function getSessionUser(event: H3Event) : Promise<SessionUser> {
  const session = await useAppSession(event)
  const { userId, sessionVersion = 0 } = session.data

  if (userId === undefined) {
    return defaultUser
  }

  // Check if the user in database
  const foundUser = await event.context.dbHttp.query.users
    .findFirst({
      columns: {
        id: true,
        isAdmin: true,
        sessionVersion: true
      },

      where: {
        id: userId
      },

      with: {
        emailCredential: { columns: { email: true } },

        oauthAccounts: {
          columns: {
            id: true
          },

          limit: 1
        }
      }
    })

  if (foundUser?.id === undefined || foundUser.sessionVersion !== sessionVersion) {
    await clearAppSession(event)

    return defaultUser
  }

  const email = foundUser.emailCredential?.email ?? null
  const isGuest = foundUser.oauthAccounts.length === 0 && email === null

  return {
    email,
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
      email: emailCredentials.email,
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
    .leftJoin(emailCredentials, eq(emailCredentials.userId, users.id))
    .where(
      eq(oauthAccounts.accountId, accountId)
    )

  if (foundUser === undefined) {
    return defaultUser
  }

  return {
    email: foundUser.email,
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
