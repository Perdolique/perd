import { createError, isError, type H3Event } from 'h3'
import type { OAuthProvider } from '#shared/types/oauth'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { oauthAccounts, users } from '#server/database/schema'

interface OAuthUserResult {
  readonly userId: string;
  readonly isAdmin: boolean;
  readonly isGuest: boolean;
}

async function createOAuthUser(
  provider: OAuthProvider,
  accountId: string,
  event: H3Event
): Promise<OAuthUserResult> {
  try {
    const dbWebsocket = createWebSocketClientFromEvent(event)

    const [transactionResult] = await Promise.allSettled([
      dbWebsocket.transaction(async (transaction) => {
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
          isAdmin: foundUser.isAdmin,
          isGuest: false
        }
      })
    ])

    if (transactionResult.status === 'rejected') {
      try {
        await dbWebsocket.$client.end()
      } catch (cleanupError) {
        const details = getAuthErrorDetails(cleanupError, [])

        console.error('OAuth account database cleanup failed', { error: details })
      }

      throw transactionResult.reason
    }

    await dbWebsocket.$client.end()

    return {
      userId: transactionResult.value.userId,
      isAdmin: transactionResult.value.isAdmin,
      isGuest: transactionResult.value.isGuest
    }
  } catch (error) {
    const details = getAuthErrorDetails(error, [])

    console.error('OAuth account creation failed', { error: details })

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
