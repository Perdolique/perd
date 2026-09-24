import { eq, lte, sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { emailCredentials, passkeyChallenges, passkeyCredentials, users } from '#server/database/schema'
import { consumePasskeyChallenge, issuePasskeyChallenge } from '#server/utils/auth/passkey-challenges'

import {
  authenticatePasskey,
  changePasskey,
  listPasskeys,
  preparePasskeyEnrollment,
  savePasskeyRegistration
} from '#server/utils/auth/passkey-persistence'

import { verifyPasskeyRegistration } from '#server/utils/auth/passkey-verification'
import { hashToken } from '#server/utils/auth/password'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'
import { createPasskeyFixture } from '../../test-utils/passkey'

vi.mock(import('nitropack/runtime'), () => {
  return { useRuntimeConfig: vi.fn() }
})

// Connections are initialized only after the local database guard in beforeAll.
// oxlint-disable-next-line init-declarations
let database: Awaited<ReturnType<typeof createIsolatedPostgreSQL>>['database']
let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null

const config = {
  origin: 'https://metsik.app',
  rpId: 'metsik.app'
}

const anonymous = {
  userId: null,
  sessionVersion: null,
  sessionIdHash: hashToken('browser')
}

function required<Value>(rows: Value[]): Value {
  const [row] = rows

  if (row === undefined) {
    throw new Error('Expected a database row')
  }

  return row
}

async function createAccount() {
  const user = required(await database.insert(users).values({}).returning())

  await database.insert(emailCredentials).values({
    userId: user.id,
    email: `${user.id}@example.com`,
    passwordHash: 'fixture-hash'
  })

  return {
    userId: user.id,
    sessionVersion: 0,
    sessionIdHash: hashToken(user.id)
  }
}

async function issueAuthentication(raw = 'challenge', createdAt = new Date()) {
  return issuePasskeyChallenge(database, {
    actor: anonymous,
    config,
    operation: 'authentication',
    challenge: raw,
    createdAt
  })
}

async function consumeAuthentication(ceremonyId: string) {
  return consumePasskeyChallenge(database, {
    actor: anonymous,
    config,
    operation: 'authentication',
    ceremonyId
  })
}

async function enroll(fixture = createPasskeyFixture()) {
  const actor = await createAccount()
  const enrollment = await preparePasskeyEnrollment(database, actor)

  const ceremonyId = await issuePasskeyChallenge(database, {
    actor,
    config,
    operation: 'registration',
    challenge: 'register',
    createdAt: new Date(),
    name: 'Laptop'
  })

  const challenge = await consumePasskeyChallenge(database, {
    actor,
    config,
    operation: 'registration',
    ceremonyId
  })

  const registration = await verifyPasskeyRegistration(fixture.registration('register'), challenge, [])

  const saved = await savePasskeyRegistration(database, {
    challenge,
    registration,
    sensitiveValues: []
  })

  return {
    actor,
    enrollment,
    fixture,
    saved,
    challenge,
    registration
  }
}

describe('passkeys on isolated PostgreSQL', () => {
  beforeAll(async () => {
    isolated = await createIsolatedPostgreSQL('passkeys')

    const { database: isolatedDatabase } = isolated

    database = isolatedDatabase
  })

  beforeEach(async () => {
    await database.delete(passkeyChallenges)
    await database.delete(users)
  })

  afterEach(() => vi.useRealTimers())

  afterAll(async () => {
    await isolated?.dispose()
  })

  it('keeps the issued attempt when equal-time and older requests arrive later', async () => {
    const createdAt = new Date()
    const older = new Date(createdAt.getTime() - 1)
    const ceremonyId = await issueAuthentication('current', createdAt)

    await expect(issuePasskeyChallenge(database, {
      actor: anonymous,
      config,
      operation: 'authentication',
      challenge: 'same-time',
      createdAt
    })).rejects.toThrow('A newer passkey ceremony')

    await expect(issuePasskeyChallenge(database, {
      actor: anonymous,
      config,
      operation: 'authentication',
      challenge: 'older',
      createdAt: older
    })).rejects.toThrow('A newer passkey ceremony')

    const rows = await database.select().from(passkeyChallenges)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.challengeHash).toBe(hashToken('current'))
    expect(rows[0]?.sessionIdHash).toBe(hashToken('browser'))

    const stored = required(rows)

    expect(stored.expiresAt.getTime()).toBe(stored.createdAt.getTime() + 300_000)
    await expect(consumeAuthentication(ceremonyId)).resolves.toMatchObject({ id: ceremonyId })
  })

  it('replaces the ceremony ID and consumes only once under concurrency', async () => {
    const oldCreatedAt = new Date()
    const newCreatedAt = new Date(oldCreatedAt.getTime() + 1)
    const oldId = await issueAuthentication('old', oldCreatedAt)
    const newId = await issueAuthentication('new', newCreatedAt)

    expect(newId).not.toBe(oldId)
    await expect(consumeAuthentication(oldId)).rejects.toThrow('Passkey challenge')

    const results = await Promise.allSettled([consumeAuthentication(newId), consumeAuthentication(newId)])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    await expect(database.select().from(passkeyChallenges)).resolves.toHaveLength(0)
  })

  it('rejects at the exact expiry boundary and accepts just before it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-22T12:00:00Z'))

    const id = await issueAuthentication()

    vi.setSystemTime(new Date('2026-09-22T12:04:59.999Z'))
    await expect(consumeAuthentication(id)).resolves.toMatchObject({ id })
    vi.setSystemTime(new Date('2026-09-22T12:00:00Z'))

    const expired = await issueAuthentication()

    vi.setSystemTime(new Date('2026-09-22T12:05:00Z'))
    await expect(consumeAuthentication(expired)).rejects.toThrow('Passkey challenge')
  })

  it('binds attempts to the session, operation, origin, account, and session version', async () => {
    const actor = await createAccount()

    const ceremonyId = await issuePasskeyChallenge(database, {
      actor,
      config,
      operation: 'registration',
      challenge: 'register',
      createdAt: new Date(),
      name: 'Laptop'
    })

    const attempts = [
      {
        actor: {
          ...actor,
          sessionIdHash: hashToken('other')
        },

        config,
        operation: 'registration' as const
      },
      {
        actor: {
          ...actor,
          sessionVersion: 1
        },

        config,
        operation: 'registration' as const
      },
      {
        actor: anonymous,
        config,
        operation: 'authentication' as const
      },
      {
        actor,

        config: {
          origin: 'https://staging.metsik.app',
          rpId: 'staging.metsik.app'
        },

        operation: 'registration' as const
      }
    ]

    const pendingAttempts = []

    for (const options of attempts) {
      pendingAttempts.push(consumePasskeyChallenge(database, {
        ...options,
        ceremonyId
      }))
    }

    const results = await Promise.allSettled(pendingAttempts)

    expect(results.every(result => result.status === 'rejected')).toBe(true)

    await expect(consumePasskeyChallenge(database, {
      actor,
      config,
      operation: 'registration',
      ceremonyId
    })).resolves.toMatchObject({ userId: actor.userId })
  })

  it('cleans at most 100 expired challenges per issuance', async () => {
    const records = Array.from({ length: 101 }, (_value, index) => {
      return {
        challengeHash: hashToken(`${index}`),
        sessionIdHash: hashToken(`session-${index}`),
        operation: 'authentication' as const,
        ...config,
        createdAt: new Date(0),
        expiresAt: new Date(1)
      }
    })

    await database.insert(passkeyChallenges).values(records)
    await issueAuthentication()

    const expired = await database.select().from(passkeyChallenges).where(lte(passkeyChallenges.expiresAt, new Date()))

    expect(expired).toHaveLength(1)
  })

  it('creates one stable random handle under concurrent enrollment and retains it after deletion', async () => {
    const actor = await createAccount()
    const results = await Promise.all([preparePasskeyEnrollment(database, actor), preparePasskeyEnrollment(database, actor)])
    const handles = results.map(result => result.userHandle)

    expect(handles[0]).toMatch(/^[\w-]{43}$/u)
    expect(handles[0]).toBe(handles[1])

    const fixture = createPasskeyFixture()

    const credentialRows = await database.insert(passkeyCredentials).values({
      userId: actor.userId,
      credentialId: fixture.credentialId,
      publicKey: fixture.publicKeyBase64,
      name: 'Last key',
      counter: 0,
      transports: [],
      backupEligible: false,
      backedUp: false
    }).returning()

    await changePasskey(database, actor, {
      action: 'remove',
      id: required(credentialRows).id
    })

    const again = await preparePasskeyEnrollment(database, actor)

    expect(again.userHandle).toBe(handles[0])
  })

  it('protects global credential ownership, hides key material, and cascades account removal', async () => {
    const { actor, saved, challenge, registration } = await enroll()
    const other = await createAccount()

    await expect(savePasskeyRegistration(database, {
      challenge: {
        ...challenge,
        userId: other.userId
      },

      registration,
      sensitiveValues: []
    })).rejects.toMatchObject({ statusCode: 409 })

    await expect(changePasskey(database, other, {
      action: 'rename',
      id: saved.id,
      name: 'Stolen'
    })).rejects.toMatchObject({ statusCode: 404 })

    await expect(changePasskey(database, other, {
      action: 'remove',
      id: saved.id
    })).rejects.toMatchObject({ statusCode: 404 })

    await expect(listPasskeys(database, actor.userId)).resolves.toStrictEqual([saved])
    expect(Object.keys(saved)).toStrictEqual(['id', 'name', 'createdAt', 'lastUsedAt'])

    await changePasskey(database, actor, {
      action: 'rename',
      id: saved.id,
      name: 'Renamed'
    })

    await issuePasskeyChallenge(database, {
      actor,
      config,
      operation: 'registration',
      name: 'Next',
      challenge: 'next',
      createdAt: new Date()
    })

    await database.delete(users).where(eq(users.id, actor.userId))
    await expect(database.select().from(passkeyCredentials)).resolves.toHaveLength(0)
    await expect(database.select().from(passkeyChallenges)).resolves.toHaveLength(0)
  })

  it('rechecks durable identity and session version before saving', async () => {
    const { actor, challenge, registration, saved } = await enroll()

    await changePasskey(database, actor, {
      action: 'remove',
      id: saved.id
    })

    await database.update(users).set({ sessionVersion: 1 }).where(eq(users.id, actor.userId))

    await expect(savePasskeyRegistration(database, {
      challenge,
      registration,
      sensitiveValues: []
    })).rejects.toThrow('Passkey account or session')

    await database.update(users).set({ sessionVersion: 0 }).where(eq(users.id, actor.userId))
    await database.delete(emailCredentials).where(eq(emailCredentials.userId, actor.userId))

    await expect(savePasskeyRegistration(database, {
      challenge,
      registration,
      sensitiveValues: []
    })).rejects.toThrow('durable sign-in method')

    await expect(database.select().from(passkeyCredentials)).resolves.toHaveLength(0)
  })

  it('serializes racing counters, accepts zero counters, and persists the full uint32 range', async () => {
    const { fixture, enrollment, actor } = await enroll()
    const challenge = await consumeAuthentication(await issueAuthentication())
    const zero = fixture.authentication('challenge', { userHandle: enrollment.userHandle })

    await authenticatePasskey(database, {
      challenge,
      response: zero,
      sensitiveValues: []
    })

    await authenticatePasskey(database, {
      challenge,
      response: zero,
      sensitiveValues: []
    })

    const response = fixture.authentication('challenge', {
      counter: 1,
      userHandle: enrollment.userHandle
    })

    const results = await Promise.allSettled([
      authenticatePasskey(database, {
        challenge,
        response,
        sensitiveValues: []
      }),
      authenticatePasskey(database, {
        challenge,
        response,
        sensitiveValues: []
      })
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)

    const maximum = fixture.authentication('challenge', {
      counter: 4_294_967_295,
      userHandle: enrollment.userHandle
    })

    await expect(authenticatePasskey(database, {
      challenge,
      response: maximum,
      sensitiveValues: []
    })).resolves.toMatchObject({ user: { userId: actor.userId } })

    const stored = required(await database.select().from(passkeyCredentials))

    expect(stored.counter).toBe(4_294_967_295)
    expect(stored.lastUsedAt).toBeInstanceOf(Date)
  })

  it('rejects mismatched handles and changes in backup eligibility without updating usage', async () => {
    const { fixture, enrollment } = await enroll()
    const challenge = await consumeAuthentication(await issueAuthentication())
    const wrongHandle = fixture.authentication('challenge')

    const changedEligibility = fixture.authentication('challenge', {
      flags: 13,
      userHandle: enrollment.userHandle
    })

    await expect(authenticatePasskey(database, {
      challenge,
      response: wrongHandle,
      sensitiveValues: []
    })).rejects.toThrow('user handle')

    await expect(authenticatePasskey(database, {
      challenge,
      response: changedEligibility,
      sensitiveValues: []
    })).rejects.toThrow('backup eligibility changed')

    const stored = required(await database.select().from(passkeyCredentials))

    expect(stored.lastUsedAt).toBeNull()
    expect(stored.counter).toBe(0)
  })

  it('observes a deletion committed while authentication waits for the account lock', async () => {
    const { actor, fixture, enrollment, saved } = await enroll()
    const challenge = await consumeAuthentication(await issueAuthentication())
    const response = fixture.authentication('challenge', { userHandle: enrollment.userHandle })
    const locked = Promise.withResolvers<null>()
    const release = Promise.withResolvers<null>()

    const removal = database.transaction(async (transaction) => {
      await transaction.select().from(users).where(eq(users.id, actor.userId)).for('update')
      locked.resolve(null)

      await release.promise

      await transaction.delete(passkeyCredentials).where(eq(passkeyCredentials.id, saved.id))
    })

    await locked.promise

    const authentication = authenticatePasskey(database, {
      challenge,
      response,
      sensitiveValues: []
    })

    const outcomes = Promise.allSettled([authentication])
    let lockCheckError: unknown = null

    try {
      await expect.poll(async () => {
        const result = await database.execute<{ credentialLockCount: number; }>(sql`
          SELECT (
            SELECT count(*)::int
            FROM pg_locks AS credential_locks
            WHERE credential_locks.pid = waiting.pid
              AND credential_locks.relation = to_regclass('passkey_credentials')
              AND credential_locks.granted = true
          ) AS "credentialLockCount"
          FROM pg_stat_activity AS waiting
          WHERE waiting.pid <> pg_backend_pid()
            AND waiting.state = 'active'
            AND waiting.wait_event_type = 'Lock'
            AND waiting.query ILIKE '%from "users"%for update%'
            AND EXISTS (
              SELECT 1
              FROM pg_locks AS user_locks
              WHERE user_locks.pid = waiting.pid
                AND user_locks.relation = to_regclass('users')
                AND user_locks.granted = true
            )
        `)

        return result.rows
      }, {
        interval: 25,
        timeout: 5000
      }).toStrictEqual([{ credentialLockCount: 0 }])
    } catch (error) {
      lockCheckError = error
    }

    release.resolve(null)

    await removal

    const [outcome] = await outcomes

    expect(lockCheckError).toBeNull()
    expect(outcome.status).toBe('rejected')
  })
})
