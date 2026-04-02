import { createError, type H3Event } from 'h3'
import type { OAuthProvider } from '#shared/types/oauth'
import { createWebSocketClient } from '#server/utils/database'
import { getRuntimeDatabaseConfig } from '#server/utils/config'
import { oauthAccounts, users } from '#server/database/schema'

interface OAuthUserResult {
  readonly userId: string;
  readonly isAdmin: boolean;
}

async function createOAuthUser(
  provider: OAuthProvider,
  accountId: string,
  event: H3Event
): Promise<OAuthUserResult> {
  try {
    const databaseConfig = getRuntimeDatabaseConfig(event)
    const dbWebsocket = createWebSocketClient(databaseConfig)

    const newUser = await dbWebsocket.transaction(async (transaction) => {
      const providerData = await transaction.query.oauthProviders.findFirst({
        columns: {
          id: true
        },

        where: {
          type: provider
        }
      })

      if (providerData === undefined) {
        throw createError({
          message: `OAuth provider ${provider} not found`,
          status: 404
        })
      }

      // Create a new user
      const [foundUser] = await transaction
        .insert(users)
        .values({})
        .returning({
          userId: users.id,
          isAdmin: users.isAdmin
        })

      if (foundUser?.userId === undefined) {
        throw createError({
          message: 'Failed to create user',
          status: 500
        })
      }

      // Link the user to the OAuth provider
      await transaction
        .insert(oauthAccounts)
        .values({
          userId: foundUser.userId,
          accountId,
          providerId: providerData.id
        })

      return {
        userId: foundUser.userId,
        isAdmin: foundUser.isAdmin
      }
    })

    return {
      userId: newUser.userId,
      isAdmin: newUser.isAdmin
    }
  } catch {
    throw createError({
      message: 'Failed to create user',
      status: 500
    })
  }
}

export { createOAuthUser }
