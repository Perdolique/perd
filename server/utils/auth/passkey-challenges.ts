import { and, eq, inArray, isNull, lt, lte, gt, sql } from 'drizzle-orm'
import { passkeyChallenges } from '#server/database/schema'
import type { createHttpClient, createWebSocketClient } from '#server/utils/database'
import { PasskeyVerificationError, type PasskeyActor, type PasskeyConfig } from './passkey-request'
import { hashToken } from './password'

type PasskeyDatabase = ReturnType<typeof createHttpClient> | ReturnType<typeof createWebSocketClient>
type PasskeyChallenge = typeof passkeyChallenges.$inferSelect
type PasskeyChallengeOperation = PasskeyChallenge['operation']

interface IssuePasskeyChallenge {
  actor: PasskeyActor;
  config: PasskeyConfig;
  operation: PasskeyChallengeOperation;
  challenge: string;
  createdAt: Date;
  name?: string;
}

interface ConsumePasskeyChallenge {
  actor: PasskeyActor;
  config: PasskeyConfig;
  operation: PasskeyChallengeOperation;
  ceremonyId: string;
}

async function issuePasskeyChallenge(database: PasskeyDatabase, options: IssuePasskeyChallenge): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(options.createdAt.getTime() + 300_000)

  const expiredIds = database
    .select({ id: passkeyChallenges.id })
    .from(passkeyChallenges)
    .where(lte(passkeyChallenges.expiresAt, now))
    .orderBy(passkeyChallenges.expiresAt)
    .limit(100)
    .for('update', { skipLocked: true })

  await database.delete(passkeyChallenges).where(inArray(passkeyChallenges.id, expiredIds))

  const values = {
    challengeHash: hashToken(options.challenge),
    sessionIdHash: options.actor.sessionIdHash,
    operation: options.operation,
    userId: options.actor.userId,
    sessionVersion: options.actor.sessionVersion,
    name: options.name ?? null,
    rpId: options.config.rpId,
    origin: options.config.origin,
    createdAt: options.createdAt,
    expiresAt
  }

  const [issued] = await database.insert(passkeyChallenges).values(values).onConflictDoUpdate({
    target: [passkeyChallenges.sessionIdHash, passkeyChallenges.operation],

    set: {
      ...values,
      id: sql`uuidv7()`
    },

    setWhere: lt(passkeyChallenges.createdAt, options.createdAt)
  }).returning()

  if (issued === undefined) {
    throw new PasskeyVerificationError('A newer passkey ceremony has replaced this request')
  }

  return issued.id
}

/** Consumption commits separately so failed verification cannot restore a challenge. */
async function consumePasskeyChallenge(database: PasskeyDatabase, options: ConsumePasskeyChallenge): Promise<PasskeyChallenge> {
  const now = new Date()

  const userCondition = options.actor.userId === null
    ? isNull(passkeyChallenges.userId)
    : eq(passkeyChallenges.userId, options.actor.userId)

  const versionCondition = options.actor.sessionVersion === null
    ? isNull(passkeyChallenges.sessionVersion)
    : eq(passkeyChallenges.sessionVersion, options.actor.sessionVersion)

  const [challenge] = await database.delete(passkeyChallenges).where(
    and(
      eq(passkeyChallenges.id, options.ceremonyId),
      eq(passkeyChallenges.sessionIdHash, options.actor.sessionIdHash),
      eq(passkeyChallenges.operation, options.operation),
      eq(passkeyChallenges.rpId, options.config.rpId),
      eq(passkeyChallenges.origin, options.config.origin),
      gt(passkeyChallenges.expiresAt, now),
      userCondition,
      versionCondition
    )
  ).returning()

  if (challenge === undefined) {
    throw new PasskeyVerificationError('Passkey challenge is expired, consumed, or belongs to another session')
  }

  return challenge
}

export { consumePasskeyChallenge, issuePasskeyChallenge }
export type { PasskeyChallenge, PasskeyDatabase }
