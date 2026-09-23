import { and, eq } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import type { AuthenticationResponseJSON, VerifiedRegistrationResponse } from '@simplewebauthn/server'
import type { PasskeySummary } from '#shared/types/passkey'
import { passkeyMessages } from '#shared/utils/passkey'
import { oauthAccounts, oauthProviders, passkeyCredentials, users } from '#server/database/schema'
import type { createWebSocketClient } from '#server/utils/database'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import type { SessionUser } from '#server/utils/user'
import { getAuthErrorDetails } from './telemetry'
import { createVerificationToken } from './password'
import { PasskeyVerificationError, type PasskeyActor } from './passkey-request'
import type { PasskeyChallenge, PasskeyDatabase } from './passkey-challenges'
import { verifyPasskeyAuthentication } from './passkey-verification'

type PasskeyWriteDatabase = ReturnType<typeof createWebSocketClient>
type PasskeyTransaction = Parameters<Parameters<PasskeyWriteDatabase['transaction']>[0]>[0]
type RegistrationInfo = NonNullable<VerifiedRegistrationResponse['registrationInfo']>
type PasskeyRecord = typeof passkeyCredentials.$inferSelect

interface PasskeySessionUser extends SessionUser {
  readonly userId: NonNullable<SessionUser['userId']>;
}

interface PasskeySessionResult {
  user: PasskeySessionUser;
  sessionVersion: number;
}

const passkeySummaryColumns = {
  id: passkeyCredentials.id,
  name: passkeyCredentials.name,
  createdAt: passkeyCredentials.createdAt,
  lastUsedAt: passkeyCredentials.lastUsedAt
}

function toPasskeySummary(row: Pick<PasskeyRecord, 'id' | 'name' | 'createdAt' | 'lastUsedAt'>): PasskeySummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null
  }
}

async function listPasskeys(database: PasskeyDatabase, userId: string): Promise<PasskeySummary[]> {
  const rows = await database.select(passkeySummaryColumns).from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, userId))
    .orderBy(passkeyCredentials.createdAt, passkeyCredentials.id)

  return rows.map(row => toPasskeySummary(row))
}

async function lockPasskeyUser(transaction: PasskeyTransaction, userId: string, sessionVersion?: number) {
  const [user] = await transaction.select({
    id: users.id,
    isAdmin: users.isAdmin,
    sessionVersion: users.sessionVersion,
    passkeyUserHandle: users.passkeyUserHandle
  }).from(users).where(eq(users.id, userId)).for('update')

  if (user === undefined || (sessionVersion !== undefined && user.sessionVersion !== sessionVersion)) {
    throw new PasskeyVerificationError('Passkey account or session is no longer valid')
  }

  return user
}

async function getRecoveryMethods(transaction: PasskeyTransaction, userId: string) {
  const email = await transaction.query.emailCredentials.findFirst({
    columns: { email: true },
    where: { userId }
  })

  const [twitch] = await transaction.select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .innerJoin(oauthProviders, eq(oauthAccounts.providerId, oauthProviders.id))
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthProviders.type, 'twitch')))

  if (email === undefined && twitch === undefined) {
    throw new PasskeyVerificationError('A durable sign-in method is required')
  }

  return {
    email: email?.email ?? null,
    isTwitchLinked: twitch !== undefined
  }
}

async function preparePasskeyEnrollment(database: PasskeyWriteDatabase, actor: PasskeyActor, sensitiveValues: string[] = []) {
  const { userId, sessionVersion } = actor

  if (userId === null || sessionVersion === null) {
    throw new PasskeyVerificationError('Registration requires an account session')
  }

  return database.transaction(async (transaction) => {
    const user = await lockPasskeyUser(transaction, userId, sessionVersion)
    const recovery = await getRecoveryMethods(transaction, userId)
    const userHandle = user.passkeyUserHandle ?? createVerificationToken()

    sensitiveValues.push(userHandle)

    if (user.passkeyUserHandle === null) {
      await transaction.update(users).set({ passkeyUserHandle: userHandle }).where(eq(users.id, userId))
    }

    const credentials = await transaction.select({
      id: passkeyCredentials.credentialId,
      transports: passkeyCredentials.transports
    }).from(passkeyCredentials).where(eq(passkeyCredentials.userId, userId))

    return {
      userHandle,
      email: recovery.email,
      credentials
    }
  })
}

async function savePasskeyRegistration(
  database: PasskeyWriteDatabase,
  options: { challenge: PasskeyChallenge; registration: RegistrationInfo; sensitiveValues: string[]; }
): Promise<PasskeySummary> {
  const { challenge, registration, sensitiveValues } = options
  const { userId, sessionVersion, name } = challenge

  if (userId === null || sessionVersion === null || name === null) {
    throw new PasskeyVerificationError('Registration challenge has no account')
  }

  const publicKey = isoBase64URL.fromBuffer(registration.credential.publicKey)

  sensitiveValues.push(publicKey, registration.credential.id)

  return database.transaction(async (transaction) => {
    await lockPasskeyUser(transaction, userId, sessionVersion)
    await getRecoveryMethods(transaction, userId)

    const [saved] = await transaction.insert(passkeyCredentials).values({
      credentialId: registration.credential.id,
      userId,
      name,
      publicKey,
      counter: registration.credential.counter,
      transports: registration.credential.transports ?? [],
      backupEligible: registration.credentialDeviceType === 'multiDevice',
      backedUp: registration.credentialBackedUp
    }).onConflictDoNothing().returning(passkeySummaryColumns)

    if (saved === undefined) {
      throw createError({
        status: 409,
        statusMessage: passkeyMessages.duplicate
      })
    }

    return toPasskeySummary(saved)
  })
}

async function authenticatePasskey(
  database: PasskeyWriteDatabase,
  options: { challenge: PasskeyChallenge; response: AuthenticationResponseJSON; sensitiveValues: string[]; }
): Promise<PasskeySessionResult> {
  const { challenge, response, sensitiveValues } = options

  const [candidate] = await database.select({ userId: passkeyCredentials.userId })
    .from(passkeyCredentials).where(eq(passkeyCredentials.credentialId, response.id))

  if (candidate === undefined) {
    throw new PasskeyVerificationError('Passkey credential was not found')
  }

  return database.transaction(async (transaction) => {
    // Account first, credential second: account deletion uses the same lock order.
    const user = await lockPasskeyUser(transaction, candidate.userId)

    const [credential] = await transaction.select().from(passkeyCredentials).where(
      and(eq(passkeyCredentials.credentialId, response.id), eq(passkeyCredentials.userId, user.id))
    ).for('update')

    sensitiveValues.push(user.passkeyUserHandle ?? '')

    if (credential === undefined || response.response.userHandle === undefined || response.response.userHandle !== user.passkeyUserHandle) {
      throw new PasskeyVerificationError('Passkey credential and user handle do not identify the same account')
    }

    sensitiveValues.push(credential.publicKey)

    const publicKey = isoBase64URL.toBuffer(credential.publicKey)

    const verificationCredential = {
      id: credential.credentialId,
      publicKey,
      counter: credential.counter
    }

    const verified = await verifyPasskeyAuthentication(response, verificationCredential, {
      challenge,
      sensitiveValues
    })

    const backupEligible = verified.credentialDeviceType === 'multiDevice'

    if (backupEligible !== credential.backupEligible) {
      throw new PasskeyVerificationError('Passkey backup eligibility changed')
    }

    const recovery = await getRecoveryMethods(transaction, user.id)
    const lastUsedAt = new Date()

    await transaction.update(passkeyCredentials).set({
      counter: verified.newCounter,
      backedUp: verified.credentialBackedUp,
      lastUsedAt
    }).where(eq(passkeyCredentials.id, credential.id))

    return {
      sessionVersion: user.sessionVersion,

      user: {
        userId: user.id,
        isAdmin: user.isAdmin,
        isGuest: false,
        email: recovery.email,
        isTwitchLinked: recovery.isTwitchLinked
      }
    }
  })
}

async function changePasskey(database: PasskeyWriteDatabase, actor: PasskeyActor, options: { id: string; name?: string; }) {
  const { id, name } = options
  const { userId, sessionVersion } = actor

  if (userId === null || sessionVersion === null) {
    throw new PasskeyVerificationError('Passkey management requires an account session')
  }

  return database.transaction(async (transaction) => {
    await lockPasskeyUser(transaction, userId, sessionVersion)

    const condition = and(eq(passkeyCredentials.id, id), eq(passkeyCredentials.userId, userId))

    const rows = name === undefined
      ? await transaction.delete(passkeyCredentials).where(condition).returning(passkeySummaryColumns)
      : await transaction.update(passkeyCredentials).set({ name }).where(condition).returning(passkeySummaryColumns)

    const [changed] = rows

    if (changed === undefined) {
      throw createError({
        status: 404,
        statusMessage: 'Passkey was not found'
      })
    }

    return toPasskeySummary(changed)
  })
}

/** Close request-owned connections without turning a committed write into an apparent failure. */
async function withPasskeyDatabase<Result>(
  event: H3Event,
  sensitiveValues: string[],
  action: (database: PasskeyWriteDatabase) => Promise<Result>
): Promise<Result> {
  const database = createWebSocketClientFromEvent(event)

  try {
    return await action(database)
  } finally {
    try {
      await database.$client.end()
    } catch (error) {
      const details = getAuthErrorDetails(error, sensitiveValues)

      console.error('Passkey database cleanup failed', { error: details })
    }
  }
}

export { authenticatePasskey, changePasskey, listPasskeys, preparePasskeyEnrollment, savePasskeyRegistration, withPasskeyDatabase }
