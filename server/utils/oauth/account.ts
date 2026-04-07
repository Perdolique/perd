import { createError, isError, type H3Event } from 'h3'
import type { OAuthProvider } from '#shared/types/oauth'
import { createWebSocketClientFromEvent } from '#server/utils/config'
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
    const dbWebsocket = createWebSocketClientFromEvent(event)

    try {
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
    } finally {
      await dbWebsocket.$client.end()
    }
  } catch (error) {
    if (isError(error)) {
      throw error
    }

    throw createError({
      message: 'Failed to create user',
      status: 500
    })
  }
}

export { createOAuthUser }
