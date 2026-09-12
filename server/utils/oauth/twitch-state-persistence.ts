import { eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { twitchOAuthStates } from '#server/database/schema'
import type { createHttpClient, createWebSocketClient } from '#server/utils/database'
import { sanitizeRedirectPath } from '#shared/utils/redirect'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'

type TwitchStateDatabase = ReturnType<typeof createHttpClient> | ReturnType<typeof createWebSocketClient>
type TwitchOAuthIntent = typeof twitchOAuthStates.$inferSelect.intent

interface TwitchOAuthActor {
  sessionIdHash: string;
  userId: string | null;
}

interface TwitchStateIssuance {
  actor: TwitchOAuthActor;
  stateHash: string;
  intent: TwitchOAuthIntent;
  redirectTo: string;
}

interface TwitchStateCompletion {
  actor: TwitchOAuthActor;
  stateHash: string;
}

interface ConsumedTwitchOAuthStateRow {
  intent: TwitchOAuthIntent;
  redirectTo: string;
  userId: string | null;
}

const expiredStateCleanupBatchSize = 100

async function issueTwitchOAuthState(database: TwitchStateDatabase, options: TwitchStateIssuance): Promise<void> {
  const now = new Date()
  const expiryTime = now.getTime() + 600_000
  const expiresAt = new Date(expiryTime)
  const redirectTo = sanitizeRedirectPath(options.redirectTo)

  const expiredStateHashes = database
    .select({ stateHash: twitchOAuthStates.stateHash })
    .from(twitchOAuthStates)
    .where(
      lte(twitchOAuthStates.expiresAt, now)
    )
    .orderBy(twitchOAuthStates.expiresAt)
    .limit(expiredStateCleanupBatchSize)
    .for('update', { skipLocked: true })

  await database.delete(twitchOAuthStates).where(
    inArray(twitchOAuthStates.stateHash, expiredStateHashes)
  )

  const values = {
    stateHash: options.stateHash,
    sessionIdHash: options.actor.sessionIdHash,
    userId: options.actor.userId,
    intent: options.intent,
    redirectTo,
    expiresAt
  }

  await database.insert(twitchOAuthStates).values(values).onConflictDoUpdate({
    target: twitchOAuthStates.sessionIdHash,
    set: values,
    setWhere: lte(twitchOAuthStates.expiresAt, expiresAt)
  })
}

/** Commit consumption before provider calls; a provider failure must never restore the state. */
async function consumeTwitchOAuthState(database: TwitchStateDatabase, options: TwitchStateCompletion) {
  const now = new Date()
  const expectedIntent = options.actor.userId === null ? 'sign-in' : 'link'

  const userCondition = options.actor.userId === null
    ? isNull(twitchOAuthStates.userId)
    : eq(twitchOAuthStates.userId, options.actor.userId)

  const query = sql<ConsumedTwitchOAuthStateRow>`
    DELETE FROM ${twitchOAuthStates}
    WHERE
      ${twitchOAuthStates.stateHash} = ${options.stateHash}
      AND ${twitchOAuthStates.sessionIdHash} = ${options.actor.sessionIdHash}
      AND ${twitchOAuthStates.intent} = ${expectedIntent}
      AND ${twitchOAuthStates.expiresAt} > ${now}
      AND ${userCondition}
    RETURNING
      ${twitchOAuthStates.intent} AS "intent",
      ${twitchOAuthStates.userId} AS "userId",
      ${twitchOAuthStates.redirectTo} AS "redirectTo"
  `

  const result = await database.execute(query)
  const [consumedAttempt] = result.rows

  if (consumedAttempt === undefined) {
    throw createError({
      status: 400,
      statusMessage: twitchOAuthMessages.invalid
    })
  }

  const redirectTo = sanitizeRedirectPath(consumedAttempt.redirectTo)

  return {
    intent: consumedAttempt.intent,
    userId: consumedAttempt.userId,
    redirectTo
  }
}

export { consumeTwitchOAuthState, issueTwitchOAuthState }
export type { TwitchOAuthActor }
