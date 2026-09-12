import { and, eq, lte, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { emailCredentials, passwordResetTokens, users } from '#server/database/schema'
import type { createWebSocketClient } from '#server/utils/database'

type PasswordRecoveryDatabase = ReturnType<typeof createWebSocketClient>
type PasswordRecoveryTransaction = Parameters<Parameters<PasswordRecoveryDatabase['transaction']>[0]>[0]

interface PasswordRecoveryIssuance {
  email: string;
  isRecipientAllowed: boolean;
  redirectTo: string;
  tokenHash: string;
}

interface PasswordRecoveryCompletion {
  email: string;
  passwordHash: string;
  tokenHash: string;
}

function invalidPasswordRecovery() {
  return createError({
    status: 400,
    statusMessage: 'The password reset link is invalid or expired'
  })
}

async function lockPasswordRecoveryEmail(
  transaction: PasswordRecoveryTransaction,
  email: string
): Promise<void> {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${email}, 749))`)
}

interface PasswordRecoveryTokenIdentity {
  email: string;
  tokenHash: string;
}

/** Serialize token issuance with reset and commit before the external delivery attempt. */
async function issuePasswordRecovery(
  database: PasswordRecoveryDatabase,
  options: PasswordRecoveryIssuance
): Promise<boolean> {
  return database.transaction(async (transaction) => {
    await lockPasswordRecoveryEmail(transaction, options.email)

    const now = new Date()

    await transaction.delete(passwordResetTokens).where(lte(passwordResetTokens.expiresAt, now))

    const credential = await transaction.query.emailCredentials.findFirst({
      columns: { email: true },
      where: { email: options.email }
    })

    if (credential === undefined || options.isRecipientAllowed === false) {
      return false
    }

    await transaction.insert(passwordResetTokens).values({
      email: options.email,
      redirectTo: options.redirectTo,
      tokenHash: options.tokenHash,
      expiresAt: new Date(now.getTime() + 3_600_000)
    })

    return true
  })
}

async function revokePasswordRecoveryToken(
  database: PasswordRecoveryDatabase,
  options: PasswordRecoveryTokenIdentity
): Promise<void> {
  await database.transaction(async (transaction) => {
    await lockPasswordRecoveryEmail(transaction, options.email)

    await transaction.delete(passwordResetTokens).where(and(
      eq(passwordResetTokens.email, options.email),
      eq(passwordResetTokens.tokenHash, options.tokenHash)
    ))
  })
}

async function findPasswordRecoveryEmail(
  database: PasswordRecoveryDatabase,
  tokenHash: string
): Promise<string> {
  const candidate = await database.query.passwordResetTokens.findFirst({
    columns: {
      email: true,
      expiresAt: true
    },

    where: { tokenHash }
  })

  if (candidate === undefined) {
    throw invalidPasswordRecovery()
  }

  if (candidate.expiresAt.getTime() <= Date.now()) {
    await database.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash))

    throw invalidPasswordRecovery()
  }

  return candidate.email
}

async function completePasswordRecovery(
  database: PasswordRecoveryDatabase,
  options: PasswordRecoveryCompletion
): Promise<void> {
  await database.transaction(async (transaction) => {
    await lockPasswordRecoveryEmail(transaction, options.email)

    const token = await transaction.query.passwordResetTokens.findFirst({
      columns: {
        email: true,
        expiresAt: true
      },

      where: { tokenHash: options.tokenHash }
    })

    if (
      token === undefined
      || token.email !== options.email
      || token.expiresAt.getTime() <= Date.now()
    ) {
      throw invalidPasswordRecovery()
    }

    const [updatedCredential] = await transaction.update(emailCredentials)
      .set({ passwordHash: options.passwordHash })
      .where(eq(emailCredentials.email, options.email))
      .returning({ userId: emailCredentials.userId })

    if (updatedCredential === undefined) {
      throw invalidPasswordRecovery()
    }

    await transaction.update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, updatedCredential.userId))

    await transaction.delete(passwordResetTokens).where(eq(passwordResetTokens.email, options.email))
  })
}

export type { PasswordRecoveryDatabase }
export {
  completePasswordRecovery,
  findPasswordRecoveryEmail,
  invalidPasswordRecovery,
  issuePasswordRecovery,
  revokePasswordRecoveryToken
}
