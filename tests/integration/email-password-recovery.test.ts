import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  completePasswordRecovery,
  findPasswordRecoveryEmail,
  issuePasswordRecovery,
  revokePasswordRecoveryToken,
  type PasswordRecoveryDatabase
} from '#server/utils/auth/password-recovery-persistence'

import { emailCredentials, passwordResetTokens, users } from '#server/database/schema'
import { hashPassword, hashToken, verifyPassword } from '#server/utils/auth/password'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

function required<Value>(rows: Value[]): Value {
  const [value] = rows

  if (value === undefined) {
    throw new Error('Expected a database row')
  }

  return value
}

const email = 'recovery@example.com'
const oldPassword = 'The original password phrase'
const newPassword = 'The replacement password phrase'

// Connections are initialized only after the local database guard in beforeAll.
// oxlint-disable-next-line init-declarations
let database: PasswordRecoveryDatabase

// oxlint-disable-next-line init-declarations
let rootDatabase: Awaited<ReturnType<typeof createIsolatedPostgreSQL>>['rootDatabase']
let isolatedPostgreSQL: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null

// oxlint-disable-next-line init-declarations
let oldPasswordHash: string

async function createCredential() {
  const user = required(await database.insert(users).values({}).returning())

  await database.insert(emailCredentials).values({
    userId: user.id,
    email,
    passwordHash: oldPasswordHash
  })

  return user
}

async function issue(token: string, selectedEmail = email) {
  return issuePasswordRecovery(database, {
    email: selectedEmail,
    isRecipientAllowed: true,
    redirectTo: '/account',
    tokenHash: hashToken(token)
  })
}

async function complete(token: string, password = newPassword) {
  const tokenHash = hashToken(token)
  const candidateEmail = await findPasswordRecoveryEmail(database, tokenHash)
  const passwordHash = await hashPassword(password)

  await completePasswordRecovery(database, {
    email: candidateEmail,
    passwordHash,
    tokenHash
  })
}

describe('email password recovery on local PostgreSQL', () => {
  beforeAll(async () => {
    isolatedPostgreSQL = await createIsolatedPostgreSQL('email_password_recovery')

    const {
      database: isolatedDatabase,
      rootDatabase: isolatedRootDatabase
    } = isolatedPostgreSQL

    database = isolatedDatabase
    rootDatabase = isolatedRootDatabase

    oldPasswordHash = await hashPassword(oldPassword)
  })

  beforeEach(async () => {
    await database.execute(sql`TRUNCATE users CASCADE`)
  })

  afterAll(async () => {
    await isolatedPostgreSQL?.dispose()
  })

  it('stores only the token hash and does nothing for an unknown email', async () => {
    await createCredential()

    const plaintextToken = 'plaintext-recovery-token'

    await issue(plaintextToken)

    const rows = await database.select().from(passwordResetTokens)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokenHash).toBe(hashToken(plaintextToken))
    expect(rows[0]?.redirectTo).toBe('/account')
    expect(JSON.stringify(rows)).not.toContain(plaintextToken)

    const unknownResult = await issue('unknown-token', 'unknown@example.com')

    expect(unknownResult).toBe(false)
    await expect(database.select().from(passwordResetTokens)).resolves.toHaveLength(1)
  })

  it('supports resend siblings, replaces the password once, and invalidates every sibling', async () => {
    await createCredential()
    await issue('first-token')
    await issue('second-token')
    await expect(database.select().from(passwordResetTokens)).resolves.toHaveLength(2)
    await complete('first-token')

    const credential = required(await database.select().from(emailCredentials).where(eq(emailCredentials.email, email)))
    const user = required(await database.select().from(users))

    await expect(verifyPassword(oldPassword, credential.passwordHash)).resolves.toBe(false)
    await expect(verifyPassword(newPassword, credential.passwordHash)).resolves.toBe(true)
    expect(user.sessionVersion).toBe(1)
    await expect(database.select().from(passwordResetTokens)).resolves.toHaveLength(0)
    await expect(findPasswordRecoveryEmail(database, hashToken('first-token'))).rejects.toMatchObject({ statusCode: 400 })
    await expect(findPasswordRecoveryEmail(database, hashToken('second-token'))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects expired and replayed tokens without changing credentials', async () => {
    await createCredential()
    await issue('expired-token')
    await database.update(passwordResetTokens).set({ expiresAt: new Date(0) })

    const expiredTokenHash = hashToken('expired-token')

    await expect(completePasswordRecovery(database, {
      email,
      passwordHash: await hashPassword(newPassword),
      tokenHash: expiredTokenHash
    })).rejects.toMatchObject({ statusCode: 400 })

    await expect(findPasswordRecoveryEmail(database, expiredTokenHash)).rejects.toMatchObject({ statusCode: 400 })
    await expect(database.select().from(passwordResetTokens)).resolves.toHaveLength(0)

    let credential = required(await database.select().from(emailCredentials))

    expect(credential.passwordHash).toBe(oldPasswordHash)
    await issue('single-use-token')
    await complete('single-use-token')
    await expect(complete('single-use-token')).rejects.toMatchObject({ statusCode: 400 })

    credential = required(await database.select().from(emailCredentials))

    await expect(verifyPassword(newPassword, credential.passwordHash)).resolves.toBe(true)
  })

  it('allows only one concurrent reset to update the password', async () => {
    await createCredential()
    await issue('concurrent-token')

    const tokenHash = hashToken('concurrent-token')
    const candidateEmail = await findPasswordRecoveryEmail(database, tokenHash)
    const firstHash = await hashPassword('First concurrent password')
    const secondHash = await hashPassword('Second concurrent password')

    const results = await Promise.allSettled([
      completePasswordRecovery(database, {
        email: candidateEmail,
        passwordHash: firstHash,
        tokenHash
      }),
      completePasswordRecovery(database, {
        email: candidateEmail,
        passwordHash: secondHash,
        tokenHash
      })
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)

    const credential = required(await database.select().from(emailCredentials))

    const matches = await Promise.all([
      verifyPassword('First concurrent password', credential.passwordHash),
      verifyPassword('Second concurrent password', credential.passwordHash)
    ])

    expect(matches.filter(Boolean)).toHaveLength(1)
    await expect(database.select().from(passwordResetTokens)).resolves.toHaveLength(0)
  })

  it('removes a committed token when delivery compensation runs', async () => {
    await createCredential()

    const tokenHash = hashToken('rejected-mail-token')

    await issuePasswordRecovery(database, {
      email,
      isRecipientAllowed: true,
      redirectTo: '/',
      tokenHash
    })

    await revokePasswordRecoveryToken(database, {
      email,
      tokenHash
    })

    await expect(database.select().from(passwordResetTokens)).resolves.toHaveLength(0)
  })

  it('purges abandoned expired tokens during the next issuance attempt', async () => {
    await createCredential()
    await issue('abandoned-token')
    await database.update(passwordResetTokens).set({ expiresAt: new Date(0) })
    await issue('unknown-token', 'unknown@example.com')
    await expect(database.select().from(passwordResetTokens)).resolves.toHaveLength(0)
  })

  it.each([
    ['credential update', 'email_credentials', 'UPDATE'],
    ['sibling deletion', 'password_reset_tokens', 'DELETE']
  ])('rolls the whole reset back after a failed %s', async (_scenario, table, operation) => {
    await createCredential()
    await issue('rollback-token')

    const functionName = `reject_recovery_${operation.toLowerCase()}`
    const triggerName = `${functionName}_trigger`

    await database.execute(sql.raw(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Simulated reset failure'; END $$`))
    await database.execute(sql.raw(`CREATE TRIGGER ${triggerName} BEFORE ${operation} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${functionName}()`))

    try {
      await expect(complete('rollback-token')).rejects.toThrow('Failed query')

      const credential = required(await database.select().from(emailCredentials))
      const user = required(await database.select().from(users))

      expect(credential.passwordHash).toBe(oldPasswordHash)
      expect(user.sessionVersion).toBe(0)
      await expect(database.select().from(passwordResetTokens)).resolves.toHaveLength(1)
    } finally {
      await database.execute(sql.raw(`DROP TRIGGER ${triggerName} ON ${table}`))
      await database.execute(sql.raw(`DROP FUNCTION ${functionName}()`))
    }
  })

  it('makes issuance and completion wait for the same email advisory lock', async () => {
    await createCredential()
    await issue('existing-token')

    async function countWaitingAdvisoryLocks() {
      const result = await rootDatabase.execute<{ count: number; }>(sql`
        SELECT count(*)::int AS count
        FROM pg_locks
        WHERE locktype = 'advisory' AND granted = false
      `)

      return required(result.rows).count
    }

    async function holdEmailLock(release: Promise<boolean>, acquired: () => boolean) {
      await database.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${email}, 749))`)
        acquired()

        await release
      })
    }

    const issuanceLock = Promise.withResolvers<boolean>()
    const issuanceLockAcquired = Promise.withResolvers<boolean>()

    const heldForIssuance = holdEmailLock(issuanceLock.promise, () => {
      issuanceLockAcquired.resolve(true)

      return true
    })

    await issuanceLockAcquired.promise

    const issuance = issue('new-token')

    await expect.poll(countWaitingAdvisoryLocks).toBeGreaterThanOrEqual(1)
    issuanceLock.resolve(true)

    await heldForIssuance
    await issuance

    const completionLock = Promise.withResolvers<boolean>()
    const completionLockAcquired = Promise.withResolvers<boolean>()

    const heldForCompletion = holdEmailLock(completionLock.promise, () => {
      completionLockAcquired.resolve(true)

      return true
    })

    await completionLockAcquired.promise

    const completion = complete('existing-token')

    await expect.poll(countWaitingAdvisoryLocks).toBeGreaterThanOrEqual(1)
    completionLock.resolve(true)

    await heldForCompletion
    await completion
  })
})
