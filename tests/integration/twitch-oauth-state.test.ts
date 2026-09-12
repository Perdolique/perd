import { randomUUID } from 'node:crypto'
import { eq, lte } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { twitchOAuthStates, users } from '#server/database/schema'
import { hashToken } from '#server/utils/auth/password'
import { consumeTwitchOAuthState, issueTwitchOAuthState } from '#server/utils/oauth/twitch-state-persistence'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

// Connections are created only after checking the local database configuration.
// oxlint-disable-next-line init-declarations
let database: Awaited<ReturnType<typeof createIsolatedPostgreSQL>>['database']
let isolatedPostgreSQL: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null

const actor = {
  userId: null,
  sessionIdHash: ''
}

async function issue(token: string) {
  await issueTwitchOAuthState(database, {
    actor,
    stateHash: hashToken(token),
    intent: 'sign-in',
    redirectTo: '/api/equipment/brands'
  })
}

async function consume(token: string) {
  return consumeTwitchOAuthState(database, {
    actor,
    stateHash: hashToken(token)
  })
}

async function createUser() {
  const [user] = await database.insert(users).values({}).returning({ id: users.id })

  if (user === undefined) {
    throw new Error('Expected a user')
  }

  return user
}

describe('twitch OAuth state on local PostgreSQL', () => {
  beforeAll(async () => {
    isolatedPostgreSQL = await createIsolatedPostgreSQL('twitch_oauth')

    const { database: isolatedDatabase } = isolatedPostgreSQL

    database = isolatedDatabase
  })

  beforeEach(async () => {
    actor.sessionIdHash = hashToken('browser-session')

    await database.delete(twitchOAuthStates)
    await database.delete(users)
  })

  afterEach(() => vi.useRealTimers())

  afterAll(async () => {
    await isolatedPostgreSQL?.dispose()
  })

  it('stores only hashes for ten minutes and keeps one latest attempt per session', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'))
    await issue('first-nonce')
    await issue('second-nonce')

    const rows = await database.select().from(twitchOAuthStates)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.stateHash).toBe(hashToken('second-nonce'))
    expect(rows[0]?.sessionIdHash).toBe(hashToken('browser-session'))
    expect(rows[0]?.expiresAt.toISOString()).toBe('2026-09-12T12:10:00.000Z')
    expect(JSON.stringify(rows)).not.toContain('second-nonce')
    expect(JSON.stringify(rows)).not.toContain('browser-session')
    await expect(consume('first-nonce')).rejects.toMatchObject({ statusCode: 400 })

    await expect(consume('second-nonce')).resolves.toStrictEqual({
      intent: 'sign-in',
      userId: null,
      redirectTo: '/api/equipment/brands'
    })

    await expect(consume('second-nonce')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('allows exactly one concurrent consumption', async () => {
    await issue('racing-nonce')

    const results = await Promise.allSettled([consume('racing-nonce'), consume('racing-nonce')])
    const fulfilled = results.filter(result => result.status === 'fulfilled')
    const rejected = results.filter(result => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.reason).toMatchObject({ statusCode: 400 })
    await expect(database.select().from(twitchOAuthStates)).resolves.toHaveLength(0)
    await expect(database.select().from(users)).resolves.toHaveLength(0)
  })

  it('does not let a delayed older issuance replace a newer state', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-12T12:01:00Z'))
    await issue('newer-nonce')
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'))
    await issue('older-nonce')

    const rows = await database.select().from(twitchOAuthStates)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.stateHash).toBe(hashToken('newer-nonce'))
    await expect(consume('older-nonce')).rejects.toMatchObject({ statusCode: 400 })
    await expect(consume('newer-nonce')).resolves.toMatchObject({ intent: 'sign-in' })
  })

  it('keeps one pending row after concurrent starts', async () => {
    await Promise.all([issue('first-nonce'), issue('second-nonce')])

    const rows = await database.select().from(twitchOAuthStates)

    expect(rows).toHaveLength(1)

    const results = await Promise.allSettled([consume('first-nonce'), consume('second-nonce')])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  })

  it('removes at most one cleanup batch during issuance', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })

    const now = new Date('2026-09-12T12:00:00Z')

    vi.setSystemTime(now)

    const expiredStates = Array.from({ length: 101 }, (_value, index) => {
      return {
        stateHash: hashToken(`expired-state-${index}`),
        sessionIdHash: hashToken(`expired-session-${index}`),
        intent: 'sign-in' as const,
        userId: null,
        redirectTo: '/',
        expiresAt: new Date(0)
      }
    })

    await database.insert(twitchOAuthStates).values(expiredStates)
    await issue('fresh-nonce')

    const expiredRows = await database.select().from(twitchOAuthStates).where(
      lte(twitchOAuthStates.expiresAt, now)
    )

    expect(expiredRows).toHaveLength(1)
    await expect(consume('fresh-nonce')).resolves.toMatchObject({ intent: 'sign-in' })
  })

  it('rejects at the exact expiry boundary and removes expired attempts during issuance', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'))
    await issue('expired-nonce')
    vi.setSystemTime(new Date('2026-09-12T12:10:00Z'))
    await expect(consume('expired-nonce')).rejects.toMatchObject({ statusCode: 400 })

    await issueTwitchOAuthState(database, {
      actor: {
        userId: null,
        sessionIdHash: hashToken('other-browser')
      },

      stateHash: hashToken('fresh-nonce'),
      intent: 'sign-in',
      redirectTo: '/'
    })

    const rows = await database.select().from(twitchOAuthStates)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.stateHash).toBe(hashToken('fresh-nonce'))
  })

  it('accepts just before expiry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'))
    await issue('valid-nonce')
    vi.setSystemTime(new Date('2026-09-12T12:09:59.999Z'))
    await expect(consume('valid-nonce')).resolves.toMatchObject({ intent: 'sign-in' })
  })

  it('rejects a different browser without consuming the original attempt', async () => {
    await issue('bound-nonce')

    await expect(consumeTwitchOAuthState(database, {
      stateHash: hashToken('bound-nonce'),

      actor: {
        userId: null,
        sessionIdHash: hashToken('other-browser')
      }
    })).rejects.toMatchObject({ statusCode: 400 })

    await expect(consume('bound-nonce')).resolves.toMatchObject({ intent: 'sign-in' })
  })

  it('binds linking to both user and session and never changes the intended operation', async () => {
    const user = await createUser()

    const linkActor = {
      userId: user.id,
      sessionIdHash: actor.sessionIdHash
    }

    const stateHash = hashToken('link-nonce')

    await issueTwitchOAuthState(database, {
      actor: linkActor,
      stateHash,
      intent: 'link',
      redirectTo: '/account'
    })

    await expect(consumeTwitchOAuthState(database, {
      actor,
      stateHash
    })).rejects.toMatchObject({ statusCode: 400 })

    await expect(consumeTwitchOAuthState(database, {
      actor: {
        userId: randomUUID(),
        sessionIdHash: actor.sessionIdHash
      },

      stateHash
    })).rejects.toMatchObject({ statusCode: 400 })

    await expect(consumeTwitchOAuthState(database, {
      actor: {
        userId: user.id,
        sessionIdHash: hashToken('another-session')
      },

      stateHash
    })).rejects.toMatchObject({ statusCode: 400 })

    await expect(consumeTwitchOAuthState(database, {
      actor: linkActor,
      stateHash
    })).resolves.toStrictEqual({
      intent: 'link',
      userId: user.id,
      redirectTo: '/account'
    })

    await issue('sign-in-nonce')

    await expect(consumeTwitchOAuthState(database, {
      actor: linkActor,
      stateHash: hashToken('sign-in-nonce')
    })).rejects.toMatchObject({ statusCode: 400 })

    await expect(consume('sign-in-nonce')).resolves.toMatchObject({ intent: 'sign-in' })
  })

  it('enforces intent ownership and removes linked attempts when their user is deleted', async () => {
    const user = await createUser()

    const values = {
      stateHash: hashToken('constraint-nonce'),
      sessionIdHash: actor.sessionIdHash,
      redirectTo: '/',
      expiresAt: new Date(Date.now() + 600_000)
    }

    await expect(database.insert(twitchOAuthStates).values({
      ...values,
      intent: 'link',
      userId: null
    })).rejects.toThrow(/./u)

    await expect(database.insert(twitchOAuthStates).values({
      ...values,
      intent: 'sign-in',
      userId: user.id
    })).rejects.toThrow(/./u)

    await database.insert(twitchOAuthStates).values({
      ...values,
      intent: 'link',
      userId: user.id
    })

    await database.delete(users).where(eq(users.id, user.id))
    await expect(database.select().from(twitchOAuthStates)).resolves.toHaveLength(0)
  })

  it('sanitizes stored and returned redirects', async () => {
    await issueTwitchOAuthState(database, {
      actor,
      stateHash: hashToken('unsafe-nonce'),
      intent: 'sign-in',
      redirectTo: '//evil.example'
    })

    await expect(consume('unsafe-nonce')).resolves.toMatchObject({ redirectTo: '/' })
    await issue('tampered-nonce')
    await database.update(twitchOAuthStates).set({ redirectTo: 'https://evil.example' })
    await expect(consume('tampered-nonce')).resolves.toMatchObject({ redirectTo: '/' })
  })
})
