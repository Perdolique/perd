import { and, eq, lte, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { emailCredentials, pendingEmailRegistrations, users } from '#server/database/schema'
import type { createWebSocketClient } from '#server/utils/database'
import { sanitizeRedirectPath } from '#shared/utils/redirect'
import { verifyPassword } from './password'

type RegistrationDatabase = ReturnType<typeof createWebSocketClient>
type RegistrationTransaction = Parameters<Parameters<RegistrationDatabase['transaction']>[0]>[0]

interface RegistrationActor {
  userId: string | null;
  sessionIdHash: string | null;
}

interface RegistrationIssuance {
  actor: RegistrationActor;
  email: string;
  passwordHash: string;
  tokenHash: string;
  redirectTo: string;
}

interface RegistrationCompletion {
  actor: RegistrationActor;
  tokenHash: string;
  password: string;
}

interface CompletedRegistration {
  userId: string;
  isAdmin: boolean;
  email: string;
  redirectTo: string;
  isNewUser: boolean;
}

function invalidRegistration() {
  return createError({
    status: 400,
    statusMessage: 'The verification link or password is invalid or expired'
  })
}

async function lockRegistrationEmail(transaction: RegistrationTransaction, email: string): Promise<void> {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${email}, 747))`)
}

async function lockRegistrationUser(transaction: RegistrationTransaction, userId: string) {
  const [user] = await transaction.select({
    id: users.id,
    isAdmin: users.isAdmin
  })
    .from(users).where(eq(users.id, userId)).for('update')

  if (user === undefined) {
    throw createError({
      status: 409,
      statusMessage: 'Return to the browser where you started adding email'
    })
  }

  const credential = await transaction.query.emailCredentials.findFirst({
    columns: { userId: true },
    where: { userId }
  })

  if (credential !== undefined) {
    throw createError({
      status: 409,
      statusMessage: 'This account already has a verified email'
    })
  }

  return user
}

async function createRegistrationUser(transaction: RegistrationTransaction) {
  const [user] = await transaction.insert(users).values({}).returning({
    id: users.id,
    isAdmin: users.isAdmin
  })

  if (user === undefined) {
    throw new Error('Registration did not create a user')
  }

  return user
}

/** Serialize issuance with completion, and roll back pending state when mail is rejected. */
async function issueEmailRegistration(
  database: RegistrationDatabase,
  options: RegistrationIssuance,
  sendMail: (isExistingAccount: boolean) => Promise<void>
): Promise<void> {
  await database.transaction(async (transaction) => {
    await lockRegistrationEmail(transaction, options.email)

    if (options.actor.userId !== null) {
      await lockRegistrationUser(transaction, options.actor.userId)
    }

    const credential = await transaction.query.emailCredentials.findFirst({
      columns: { userId: true },
      where: { email: options.email }
    })

    if (credential === undefined) {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 3_600_000)

      await transaction.delete(pendingEmailRegistrations).where(and(
        eq(pendingEmailRegistrations.email, options.email),
        lte(pendingEmailRegistrations.expiresAt, now)
      ))

      await transaction.insert(pendingEmailRegistrations).values({
        email: options.email,
        passwordHash: options.passwordHash,
        tokenHash: options.tokenHash,
        redirectTo: options.redirectTo,
        userId: options.actor.userId,
        sessionIdHash: options.actor.sessionIdHash,
        expiresAt
      })
    }

    await sendMail(credential !== undefined)
  })
}

function assertRegistrationActor(
  pending: typeof pendingEmailRegistrations.$inferSelect,
  actor: RegistrationActor
): void {
  if (pending.userId === null) {
    if (actor.userId !== null) {
      throw createError({
        status: 409,
        statusMessage: 'Open this link in a signed-out browser to create a new account'
      })
    }

    return
  }

  if (pending.userId !== actor.userId || pending.sessionIdHash !== actor.sessionIdHash) {
    throw createError({
      status: 409,
      statusMessage: 'Return to the browser where you started adding email'
    })
  }
}

async function completeEmailRegistration(
  database: RegistrationDatabase,
  options: RegistrationCompletion
): Promise<CompletedRegistration> {
  const candidate = await database.query.pendingEmailRegistrations.findFirst({
    where: { tokenHash: options.tokenHash }
  })

  if (candidate === undefined || candidate.expiresAt.getTime() <= Date.now()) {
    throw invalidRegistration()
  }

  assertRegistrationActor(candidate, options.actor)

  const passwordMatches = await verifyPassword(options.password, candidate.passwordHash)

  if (!passwordMatches) {
    throw invalidRegistration()
  }

  return database.transaction(async (transaction) => {
    await lockRegistrationEmail(transaction, candidate.email)

    const pending = await transaction.query.pendingEmailRegistrations.findFirst({
      where: { tokenHash: options.tokenHash }
    })

    if (pending === undefined || pending.expiresAt.getTime() <= Date.now()) {
      throw invalidRegistration()
    }

    assertRegistrationActor(pending, options.actor)

    const credential = await transaction.query.emailCredentials.findFirst({
      columns: { userId: true },
      where: { email: pending.email }
    })

    if (credential !== undefined) {
      throw invalidRegistration()
    }

    const user = pending.userId === null
      ? await createRegistrationUser(transaction)
      : await lockRegistrationUser(transaction, pending.userId)

    await transaction.insert(emailCredentials).values({
      userId: user.id,
      email: pending.email,
      passwordHash: pending.passwordHash
    })

    await transaction.delete(pendingEmailRegistrations).where(eq(pendingEmailRegistrations.email, pending.email))

    const redirectTo = sanitizeRedirectPath(pending.redirectTo)

    return {
      userId: user.id,
      isAdmin: user.isAdmin,
      email: pending.email,
      redirectTo,
      isNewUser: pending.userId === null
    }
  })
}

export type { RegistrationActor, RegistrationDatabase, RegistrationIssuance, CompletedRegistration }
export { completeEmailRegistration, issueEmailRegistration }
