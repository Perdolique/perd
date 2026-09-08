import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { env } from 'node:process'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebSocketClient } from '#server/utils/database'

import {
  completeEmailRegistration,
  issueEmailRegistration,
  type RegistrationActor,
  type RegistrationDatabase
} from '#server/utils/auth/email-registration-persistence'

import { getUserByOAuthAccount } from '#server/utils/user'
import { createTestEvent } from '../../test-utils/create-test-event'
import { hashPassword, hashToken } from '#server/utils/auth/password'

import {
  brands,
  contributions,
  emailCredentials,
  equipmentCategories,
  equipmentItems,
  oauthAccounts,
  oauthProviders,
  packingListEntries,
  packingLists,
  pendingEmailRegistrations,
  userEquipment,
  users
} from '#server/database/schema'

vi.mock(import('#server/utils/session'), () => { return {} })

function required<Value>(rows: Value[]): Value {
  const [value] = rows

  if (value === undefined) {
    throw new Error('Expected a database row')
  }

  return value
}

const password = 'An exact long passphrase 🌲 '

const anonymous: RegistrationActor = {
  userId: null,
  sessionIdHash: null
}

// Connections are initialized only after the local database guard in beforeAll.
// oxlint-disable-next-line init-declarations
let database: RegistrationDatabase
let rootDatabase: RegistrationDatabase | null = null
// oxlint-disable-next-line init-declarations
let schemaName: string
// oxlint-disable-next-line init-declarations
let passwordHash: string

async function issue(email: string, token: string, actor = anonymous) {
  await issueEmailRegistration(database, {
    actor,
    email,
    passwordHash,
    tokenHash: hashToken(token),
    redirectTo: '/account'
  }, async () => {
    // Simulated mail accepted.
  })
}

async function complete(token: string, actor = anonymous, selectedPassword = password) {
  return completeEmailRegistration(database, {
    actor,
    tokenHash: hashToken(token),
    password: selectedPassword
  })
}

async function readAccountData() {
  return Promise.all([
    database.select().from(users),
    database.select().from(userEquipment),
    database.select().from(packingLists),
    database.select().from(packingListEntries),
    database.select().from(contributions),
    database.select().from(oauthAccounts)
  ])
}

describe('email registration on local PostgreSQL', () => {
  async function addOAuthIdentity(enabled: boolean, userId: string) {
    if (enabled) {
      const provider = required(await database.select().from(oauthProviders).where(eq(oauthProviders.type, 'twitch')))

      await database.insert(oauthAccounts).values({
        userId,
        providerId: provider.id,
        accountId: 'existing-twitch'
      })
    }
  }

  beforeAll(async () => {
    if (!['true', '1'].includes(env.NUXT_LOCAL_DATABASE ?? '')) {
      throw new Error('Integration tests require NUXT_LOCAL_DATABASE=true')
    }

    const url = new globalThis.URL(env.NUXT_DATABASE_URL ?? '')

    if (!['localhost', '127.0.0.1', 'db.localtest.me'].includes(url.hostname)) {
      throw new Error('Integration tests require a local PostgreSQL host')
    }

    rootDatabase = createWebSocketClient({
      databaseUrl: url.toString(),
      isLocalDatabase: true
    })
    schemaName = `email_registration_${randomUUID().replaceAll('-', '')}`
    await rootDatabase.execute(sql.raw(`CREATE SCHEMA "${schemaName}"`))
    url.searchParams.set('options', `-c search_path=${schemaName}`)
    database = createWebSocketClient({
      databaseUrl: url.toString(),
      isLocalDatabase: true
    })

    const schema = await database.execute<{ name: string; }>(sql`SELECT current_schema() AS name`)

    if (schema.rows[0]?.name !== schemaName) {
      throw new Error('Isolated schema was not selected; refusing to run migrations')
    }

    const migrations = new globalThis.URL('../../server/database/migrations/', import.meta.url)
    const folders = await readdir(migrations)
    const migrationNames = folders.filter(name => /^\d{14}_/u.test(name)).toSorted()

    // Each migration depends on the preceding schema version.
    for (const name of migrationNames) {
      // oxlint-disable-next-line no-await-in-loop
      const migration = await readFile(new globalThis.URL(`${name}/migration.sql`, migrations), 'utf8')

      // oxlint-disable-next-line no-await-in-loop
      await database.execute(sql.raw(migration))
    }

    passwordHash = await hashPassword(password)
  })

  beforeEach(async () => {
    await database.execute(sql`TRUNCATE users, equipment_categories, brands CASCADE`)
  })

  afterAll(async () => {
    await database.$client.end()

    if (rootDatabase !== null && /^email_registration_[\da-f]{32}$/u.test(schemaName)) {
      await rootDatabase.execute(sql.raw(`DROP SCHEMA "${schemaName}" CASCADE`))
      await rootDatabase.$client.end()
    }
  })

  it.each([['same token', 'first'], ['sibling tokens', 'second']])('creates at most one account for concurrent %s', async (_scenario, second) => {
    await issue('new@example.com', 'first')
    await issue('new@example.com', 'second')

    const results = await Promise.allSettled([complete('first'), complete(second)])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    await expect(database.select().from(users)).resolves.toHaveLength(1)
    await expect(database.select().from(emailCredentials)).resolves.toHaveLength(1)
    await expect(database.select().from(pendingEmailRegistrations)).resolves.toHaveLength(0)
    await expect(complete('first')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('preserves each link password when resending', async () => {
    const otherPassword = 'A different exact passphrase 🌳'
    const otherHash = await hashPassword(otherPassword)

    await issue('new@example.com', 'first')

    await issueEmailRegistration(database, {
      actor: anonymous,
      email: 'new@example.com',
      tokenHash: hashToken('second'),
      passwordHash: otherHash,
      redirectTo: '/account'
    }, async () => {
    // Simulated mail accepted.
  })

    await expect(complete('first', anonymous, otherPassword)).rejects.toMatchObject({ statusCode: 400 })
    await expect(database.select().from(users)).resolves.toHaveLength(0)
    await expect(complete('first')).resolves.toMatchObject({ email: 'new@example.com' })
  })

  it('rejects wrong passwords, expired links and foreign sessions without mutation', async () => {
    await issue('new@example.com', 'first')

    const before = await database.select().from(pendingEmailRegistrations)

    await expect(complete('first', anonymous, 'A completely incorrect password')).rejects.toMatchObject({ statusCode: 400 })

    await expect(complete('first', {
      userId: randomUUID(),
      sessionIdHash: hashToken('foreign')
    })).rejects.toMatchObject({ statusCode: 409 })

    await expect(database.select().from(pendingEmailRegistrations)).resolves.toStrictEqual(before)
    await database.update(pendingEmailRegistrations).set({ expiresAt: new Date(0) })
    await expect(complete('first')).rejects.toMatchObject({ statusCode: 400 })
    await expect(database.select().from(users)).resolves.toHaveLength(0)
    await expect(database.select().from(emailCredentials)).resolves.toHaveLength(0)
  })

  it('rolls back pending state when delivery is rejected', async () => {
    await expect(issueEmailRegistration(database, {
      actor: anonymous,
      email: 'new@example.com',
      passwordHash,
      tokenHash: hashToken('first'),
      redirectTo: '/account'
    }, async () => {
      await Promise.reject(new Error('Simulated delivery rejection'))
    })).rejects.toThrow('Simulated delivery rejection')

    await expect(database.select().from(pendingEmailRegistrations)).resolves.toHaveLength(0)
    await expect(database.select().from(users)).resolves.toHaveLength(0)
  })

  it('rolls back account creation and preserves the token when credential insertion fails', async () => {
    await issue('new@example.com', 'first')
    await database.execute(sql`CREATE FUNCTION reject_credentials() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Simulated credential failure'; END $$`)
    await database.execute(sql`CREATE TRIGGER reject_credentials BEFORE INSERT ON email_credentials FOR EACH ROW EXECUTE FUNCTION reject_credentials()`)

    try {
      await expect(complete('first')).rejects.toThrow('Failed query')
      await expect(database.select().from(users)).resolves.toHaveLength(0)
      await expect(database.select().from(emailCredentials)).resolves.toHaveLength(0)
      await expect(database.select().from(pendingEmailRegistrations)).resolves.toHaveLength(1)
    } finally {
      await database.execute(sql`DROP TRIGGER reject_credentials ON email_credentials`)
      await database.execute(sql`DROP FUNCTION reject_credentials()`)
    }

    await expect(complete('first')).resolves.toMatchObject({ email: 'new@example.com' })
  })

  it('notifies an existing email without creating a pending registration', async () => {
    await issue('existing@example.com', 'first')
    await complete('first')

    const mail = vi.fn<() => Promise<void>>().mockResolvedValue()

    await issueEmailRegistration(database, {
      actor: anonymous,
      email: 'existing@example.com',
      passwordHash,
      tokenHash: hashToken('second'),
      redirectTo: '/account'
    }, mail)

    expect(mail).toHaveBeenCalledExactlyOnceWith(true)
    await expect(database.select().from(pendingEmailRegistrations)).resolves.toHaveLength(0)
    await expect(database.select().from(users)).resolves.toHaveLength(1)
  })

  it('returns the verified email when the same user signs in through Twitch', async () => {
    const user = required(await database.insert(users).values({ isAdmin: true }).returning())
    const provider = required(await database.select().from(oauthProviders).where(eq(oauthProviders.type, 'twitch')))

    await database.insert(oauthAccounts).values({
      userId: user.id,
      providerId: provider.id,
      accountId: 'returning-twitch'
    })

    await database.insert(emailCredentials).values({
      userId: user.id,
      email: 'returning@example.com',
      passwordHash
    })

    await expect(getUserByOAuthAccount('twitch', 'returning-twitch', createTestEvent(database))).resolves.toStrictEqual({
      userId: user.id,
      email: 'returning@example.com',
      isAdmin: true,
      isGuest: false
    })
  })

  it('allows only one of two different email addresses to attach to a user', async () => {
    const user = required(await database.insert(users).values({}).returning())

    const actor = {
      userId: user.id,
      sessionIdHash: hashToken('original-session')
    }

    await issue('first@example.com', 'first', actor)
    await issue('second@example.com', 'second', actor)

    const results = await Promise.allSettled([complete('first', actor), complete('second', actor)])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    await expect(database.select().from(users)).resolves.toHaveLength(1)
    await expect(database.select().from(emailCredentials)).resolves.toHaveLength(1)
  })

  it.each([false, true])('preserves identity, rights, gear, lists and contributions with OAuth=%s', async (hasOAuth) => {
    const user = required(await database.insert(users).values({
      isAdmin: true,
      guestSessionId: 'existing-guest-session',
      name: 'Existing user'
    }).returning())

    const brand = required(await database.insert(brands).values({
      name: 'Test brand',
      slug: 'test-brand'
    }).returning())

    const category = required(await database.insert(equipmentCategories).values({
      name: 'Test category',
      slug: 'test-category'
    }).returning())

    const item = required(await database.insert(equipmentItems).values({
      name: 'Existing gear',
      brandId: brand.id,
      categoryId: category.id,
      createdBy: user.id
    }).returning())

    const gear = required(await database.insert(userEquipment).values({
      userId: user.id,
      itemId: item.id
    }).returning())

    const list = required(await database.insert(packingLists).values({
      userId: user.id,
      name: 'Existing trip'
    }).returning())

    await database.insert(packingListEntries).values({
      packingListId: list.id,
      userEquipmentId: gear.id,
      isPacked: true
    })

    await database.insert(contributions).values({
      userId: user.id,
      action: 'create',
      targetId: item.id
    })

    await addOAuthIdentity(hasOAuth, user.id)

    const before = await readAccountData()

    const actor = {
      userId: user.id,
      sessionIdHash: hashToken('original-session')
    }

    await issue('upgrade@example.com', 'first', actor)
    await issue('unused-upgrade@example.com', 'unconfirmed', actor)
    await expect(complete('first')).rejects.toMatchObject({ statusCode: 409 })

    await expect(complete('first', {
      ...actor,
      sessionIdHash: hashToken('replacement-session')
    })).rejects.toMatchObject({ statusCode: 409 })

    await expect(readAccountData()).resolves.toStrictEqual(before)

    await expect(complete('first', actor)).resolves.toMatchObject({
      userId: user.id,
      isAdmin: true,
      isNewUser: false,
      redirectTo: '/account'
    })

    await expect(readAccountData()).resolves.toStrictEqual(before)

    await expect(database.select().from(emailCredentials)).resolves.toMatchObject([{
      userId: user.id,
      email: 'upgrade@example.com'
    }])

    await database.delete(packingListEntries)

    const remainingRegistrations = await database.select({
      userId: pendingEmailRegistrations.userId,
      email: pendingEmailRegistrations.email
    }).from(pendingEmailRegistrations)

    expect(remainingRegistrations).toStrictEqual([{
      userId: user.id,
      email: 'unused-upgrade@example.com'
    }])

    await database.delete(users).where(eq(users.id, user.id))
    await expect(database.select().from(emailCredentials)).resolves.toHaveLength(0)
    await expect(database.select().from(pendingEmailRegistrations)).resolves.toHaveLength(0)
  })
})
