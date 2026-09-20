import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  brands,
  contributions,
  emailCredentials,
  equipmentCategories,
  equipmentItems,
  oauthAccounts,
  packingListEntries,
  packingLists,
  userEquipment,
  users
} from '#server/database/schema'

import { linkOAuthAccount, unlinkOAuthAccount } from '#server/utils/oauth/account'
import { getUserByOAuthAccount } from '#server/utils/user'
import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
import { createTestEvent } from '../../test-utils/create-test-event'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

type TestDatabase = Awaited<ReturnType<typeof createIsolatedPostgreSQL>>['database']

function required<Value>(rows: Value[]): Value {
  const [value] = rows

  if (value === undefined) {
    throw new Error('Expected a database row')
  }

  return value
}

// Connections are initialized only after the local database guard in beforeAll.
// oxlint-disable-next-line init-declarations
let database: TestDatabase
let isolatedPostgreSQL: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null

vi.mock(import('#server/utils/config'), () => {
  return {
    createWebSocketClientFromEvent: () => database
  }
})

async function createUser(isAdmin = false) {
  return required(await database.insert(users).values({ isAdmin }).returning())
}

async function link(accountId: string, userId: string, sessionVersion = 0) {
  return linkOAuthAccount(createTestEvent(database), {
    accountId,
    provider: 'twitch',
    sessionVersion,
    userId
  })
}

async function readProtectedAccountData() {
  return Promise.all([
    database.select().from(users),
    database.select().from(emailCredentials),
    database.select().from(userEquipment),
    database.select().from(packingLists),
    database.select().from(packingListEntries),
    database.select().from(contributions),
    database.select().from(oauthAccounts)
  ])
}

async function readAccountDataWithoutOAuth() {
  return Promise.all([
    database.select().from(users),
    database.select().from(emailCredentials),
    database.select().from(userEquipment),
    database.select().from(packingLists),
    database.select().from(packingListEntries),
    database.select().from(contributions)
  ])
}

describe('twitch account linking on local PostgreSQL', () => {
  beforeAll(async () => {
    isolatedPostgreSQL = await createIsolatedPostgreSQL('twitch_linking')

    const { database: isolatedDatabase } = isolatedPostgreSQL

    database = isolatedDatabase

    vi.spyOn(database.$client, 'end').mockResolvedValue()
  })

  beforeEach(async () => {
    await database.execute(sql`TRUNCATE users, equipment_categories, brands CASCADE`)
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await isolatedPostgreSQL?.dispose()
  })

  it('keeps repeated linking idempotent with one row', async () => {
    const user = await createUser()

    await link('same-twitch', user.id)
    await link('same-twitch', user.id)
    await expect(database.select().from(oauthAccounts)).resolves.toHaveLength(1)

    await expect(getUserByOAuthAccount(
      'twitch',
      'same-twitch',
      createTestEvent(database)
    )).resolves.toMatchObject({
      isTwitchLinked: true,
      userId: user.id
    })
  })

  it('does not link after the session version changes', async () => {
    const user = await createUser()

    await database.update(users)
      .set({ sessionVersion: 1 })
      .where(eq(users.id, user.id))

    await expect(link('late-twitch', user.id)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: twitchOAuthMessages.invalid
    })

    await expect(database.select().from(oauthAccounts)).resolves.toHaveLength(0)
  })

  it('allows only one user to win parallel callbacks for one Twitch identity', async () => {
    const firstUser = await createUser()
    const secondUser = await createUser()

    const results = await Promise.allSettled([
      link('shared-twitch', firstUser.id),
      link('shared-twitch', secondUser.id)
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)

    const rejected = results.filter(result => result.status === 'rejected')

    expect(rejected).toHaveLength(1)

    expect(rejected[0]).toMatchObject({
      reason: {
        statusCode: 409,
        statusMessage: twitchOAuthMessages.linkConflict
      }
    })

    const [linkedAccount] = await database.select().from(oauthAccounts)

    expect(linkedAccount).toBeDefined()

    await expect(getUserByOAuthAccount(
      'twitch',
      'shared-twitch',
      createTestEvent(database)
    )).resolves.toMatchObject({ userId: linkedAccount?.userId })
  })

  it('allows only one Twitch identity to win parallel callbacks for one user', async () => {
    const user = await createUser()

    const results = await Promise.allSettled([
      link('first-twitch', user.id),
      link('second-twitch', user.id)
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)

    const rejected = results.filter(result => result.status === 'rejected')

    expect(rejected).toHaveLength(1)

    expect(rejected[0]).toMatchObject({
      reason: {
        statusCode: 409,
        statusMessage: twitchOAuthMessages.linkConflict
      }
    })

    const accounts = await database.select().from(oauthAccounts)

    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.userId).toBe(user.id)
  })

  it('leaves both accounts and all owned data unchanged after an ownership conflict', async () => {
    const originalUser = await createUser()
    const currentUser = await createUser(true)

    await link('owned-twitch', originalUser.id)

    await database.insert(emailCredentials).values({
      email: 'current@example.com',
      passwordHash: 'test-password-hash',
      userId: currentUser.id
    })

    const brand = required(await database.insert(brands).values({
      name: 'Test brand',
      slug: 'test-brand'
    }).returning())

    const category = required(await database.insert(equipmentCategories).values({
      name: 'Test category',
      slug: 'test-category'
    }).returning())

    const item = required(await database.insert(equipmentItems).values({
      brandId: brand.id,
      categoryId: category.id,
      createdBy: currentUser.id,
      name: 'Existing gear'
    }).returning())

    const gear = required(await database.insert(userEquipment).values({
      itemId: item.id,
      userId: currentUser.id
    }).returning())

    const packingList = required(await database.insert(packingLists).values({
      name: 'Existing trip',
      userId: currentUser.id
    }).returning())

    await database.insert(packingListEntries).values({
      isPacked: true,
      packingListId: packingList.id,
      userEquipmentId: gear.id
    })

    await database.insert(contributions).values({
      action: 'create',
      targetId: item.id,
      userId: currentUser.id
    })

    const before = await readProtectedAccountData()

    await expect(link('owned-twitch', currentUser.id)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: twitchOAuthMessages.linkConflict
    })

    await expect(readProtectedAccountData()).resolves.toStrictEqual(before)

    await expect(getUserByOAuthAccount(
      'twitch',
      'owned-twitch',
      createTestEvent(database)
    )).resolves.toMatchObject({
      isAdmin: false,
      userId: originalUser.id
    })

    await expect(database.select().from(users).where(eq(users.id, currentUser.id))).resolves.toMatchObject([{
      id: currentUser.id,
      isAdmin: true
    }])
  })

  it('disconnects Twitch while preserving the email account and all owned data', async () => {
    const user = await createUser(true)

    await link('detached-twitch', user.id)

    await database.insert(emailCredentials).values({
      email: 'owner@example.com',
      passwordHash: 'test-password-hash',
      userId: user.id
    })

    const brand = required(await database.insert(brands).values({
      name: 'Owned brand',
      slug: 'owned-brand'
    }).returning())

    const category = required(await database.insert(equipmentCategories).values({
      name: 'Owned category',
      slug: 'owned-category'
    }).returning())

    const item = required(await database.insert(equipmentItems).values({
      brandId: brand.id,
      categoryId: category.id,
      createdBy: user.id,
      name: 'Owned gear'
    }).returning())

    const gear = required(await database.insert(userEquipment).values({
      itemId: item.id,
      userId: user.id
    }).returning())

    const packingList = required(await database.insert(packingLists).values({
      name: 'Owned trip',
      userId: user.id
    }).returning())

    await database.insert(packingListEntries).values({
      isPacked: true,
      packingListId: packingList.id,
      userEquipmentId: gear.id
    })

    await database.insert(contributions).values({
      action: 'create',
      targetId: item.id,
      userId: user.id
    })

    const before = await readAccountDataWithoutOAuth()

    await unlinkOAuthAccount(createTestEvent(database), {
      provider: 'twitch',
      userId: user.id
    })

    await expect(readAccountDataWithoutOAuth()).resolves.toStrictEqual(before)
    await expect(database.select().from(oauthAccounts)).resolves.toHaveLength(0)

    await expect(getUserByOAuthAccount(
      'twitch',
      'detached-twitch',
      createTestEvent(database)
    )).resolves.toMatchObject({
      isTwitchLinked: false,
      userId: null
    })

    await expect(database.select().from(users).where(eq(users.id, user.id))).resolves.toMatchObject([{
      id: user.id,
      isAdmin: true
    }])
  })

  it('does not disconnect another user with the same provider', async () => {
    const disconnectedUser = await createUser()
    const otherUser = await createUser()

    await link('disconnected-twitch', disconnectedUser.id)
    await link('other-twitch', otherUser.id)

    await unlinkOAuthAccount(createTestEvent(database), {
      provider: 'twitch',
      userId: disconnectedUser.id
    })

    await expect(database.select().from(oauthAccounts)).resolves.toMatchObject([{
      accountId: 'other-twitch',
      userId: otherUser.id
    }])
  })
})
