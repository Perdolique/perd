import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import type { OAuthProvider } from '#shared/types/oauth'
import { useAppSession } from '#server/utils/session'
import { oauthAccounts, oauthProviders, users } from '#server/database/schema'

interface ReturnUser {
  readonly userId: string | null;
  readonly isAdmin: boolean;
}

const defaultUser : ReturnUser = {
  userId: null,
  isAdmin: false
}

async function getSessionUser(event: H3Event) : Promise<ReturnUser> {
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
      }
    })

  if (foundUser?.id === undefined) {
    return defaultUser
  }

  return {
    userId: foundUser.id,
    isAdmin: foundUser.isAdmin
  }
}

async function getUserByOAuthAccount(
  provider: OAuthProvider,
  accountId: string,
  event: H3Event
) : Promise<ReturnUser> {
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
        eq(oauthProviders.type, provider),
        eq(oauthAccounts.accountId, accountId)
      )
    )
    .innerJoin(
      users,
      eq(users.id, oauthAccounts.userId)
    )

  return foundUser ?? defaultUser
}

export { getSessionUser, getUserByOAuthAccount }
