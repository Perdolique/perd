import { createError, isError, type H3Event } from 'h3'
import { and, eq, or } from 'drizzle-orm'
import type { OAuthProvider } from '#shared/types/oauth'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { oauthAccounts, oauthProviders, users } from '#server/database/schema'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'

interface OAuthUserResult {
  readonly userId: string;
  readonly isAdmin: boolean;
  readonly isGuest: boolean;
  readonly sessionVersion: number;
}

interface LinkOAuthAccountOptions {
  accountId: string;
  provider: OAuthProvider;
  sessionVersion: number;
  userId: string;
}

interface UnlinkOAuthAccountOptions {
  provider: OAuthProvider;
  userId: string;
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
            isAdmin: users.isAdmin,
            sessionVersion: users.sessionVersion
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
          isGuest: false,
          sessionVersion: foundUser.sessionVersion
        }
      })
    ])

    try {
      await dbWebsocket.$client.end()
    } catch (cleanupError) {
      const details = getAuthErrorDetails(cleanupError, [])

      console.error('OAuth account database cleanup failed', { error: details })
    }

    if (transactionResult.status === 'rejected') {
      throw transactionResult.reason
    }

    return {
      userId: transactionResult.value.userId,
      isAdmin: transactionResult.value.isAdmin,
      isGuest: transactionResult.value.isGuest,
      sessionVersion: transactionResult.value.sessionVersion
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

async function linkOAuthAccount(
  event: H3Event,
  options: LinkOAuthAccountOptions
) {
  const { accountId, provider, sessionVersion, userId } = options
  const dbWebsocket = createWebSocketClientFromEvent(event)

  const [transactionResult] = await Promise.allSettled([
    dbWebsocket.transaction(async (transaction) => {
      const [lockedUser] = await transaction
        .select({
          id: users.id,
          isAdmin: users.isAdmin,
          sessionVersion: users.sessionVersion
        })
        .from(users)
        .where(eq(users.id, userId))
        .for('update')

      if (lockedUser === undefined || lockedUser.sessionVersion !== sessionVersion) {
        throw createError({
          status: 400,
          statusMessage: twitchOAuthMessages.invalid
        })
      }

      const credential = await transaction.query.emailCredentials.findFirst({
        columns: { email: true },
        where: { userId }
      })

      const providerData = await transaction.query.oauthProviders.findFirst({
        columns: { id: true },
        where: { type: provider }
      })

      if (providerData === undefined) {
        throw createError({
          message: `OAuth provider ${provider} not found`,
          status: 404
        })
      }

      const [linkedAccount] = await transaction
        .insert(oauthAccounts)
        .values({
          accountId,
          providerId: providerData.id,
          userId
        })
        .onConflictDoNothing()
        .returning({ id: oauthAccounts.id })

      if (linkedAccount === undefined) {
        const conflictingAccounts = await transaction
          .select({
            accountId: oauthAccounts.accountId,
            userId: oauthAccounts.userId
          })
          .from(oauthAccounts)
          .innerJoin(oauthProviders, eq(oauthProviders.id, oauthAccounts.providerId))
          .where(
            and(
              eq(oauthProviders.type, provider),
              or(
                eq(oauthAccounts.accountId, accountId),
                eq(oauthAccounts.userId, userId)
              )
            )
          )

        const isAlreadyLinked = conflictingAccounts.some(
          account => account.accountId === accountId && account.userId === userId
        )

        if (isAlreadyLinked === false) {
          throw createError({
            status: 409,
            statusMessage: twitchOAuthMessages.linkConflict
          })
        }
      }

      return {
        email: credential?.email ?? null,
        isAdmin: lockedUser.isAdmin,
        isGuest: false,
        userId: lockedUser.id
      }
    })
  ])

  try {
    await dbWebsocket.$client.end()
  } catch (cleanupError) {
    const details = getAuthErrorDetails(cleanupError, [])

    console.error('OAuth account database cleanup failed', { error: details })
  }

  if (transactionResult.status === 'rejected') {
    throw transactionResult.reason
  }

  return transactionResult.value
}

async function unlinkOAuthAccount(
  event: H3Event,
  options: UnlinkOAuthAccountOptions
): Promise<void> {
  const { provider, userId } = options

  const providerData = await event.context.dbHttp.query.oauthProviders.findFirst({
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

  await event.context.dbHttp
    .delete(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.providerId, providerData.id),
        eq(oauthAccounts.userId, userId)
      )
    )
}

export { createOAuthUser, linkOAuthAccount, unlinkOAuthAccount }
