// oxlint-disable-next-line typescript/triple-slash-reference -- Real handlers require the generated Worker globals.
/// <reference path="../../server/types/worker-configuration.d.ts" />
import { asc, eq, sql } from 'drizzle-orm'
import type * as nuxtServer from 'nuxt/server'
import { createError } from 'nuxt/server'
import * as v from 'valibot'
import { afterAll, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  brands,
  equipmentCategories,
  equipmentItems,
  packingListEntries,
  packingLists,
  userEquipment,
  users
} from '#server/database/schema'

import { createHttpClient, createWebSocketClient } from '#server/utils/database'
import clearPacked from '#server/api/user/packing-lists/[id]/clear-packed.post'
import getList from '#server/api/user/packing-lists/[id].get'
import renameList from '#server/api/user/packing-lists/[id].patch'
import addEntry from '#server/api/user/packing-lists/[id]/entries/index.post'
import packEntry from '#server/api/user/packing-lists/[id]/entries/[entry-id].patch'
import removeEntry from '#server/api/user/packing-lists/[id]/entries/[entry-id].delete'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'
import { createTestEvent } from '../../test-utils/create-test-event'

const requestGates = new WeakMap<nuxtServer.RequestEvent, Promise<boolean>>()

vi.mock(import('#server/utils/session'), () => {
  return {
    async validateSessionUser(event: nuxtServer.RequestEvent) {
      await requestGates.get(event)

      if (event.context.testUserId === null) {
        throw createError({ status: 401 })
      }

      return v.parse(v.string(), event.context.testUserId)
    }
  }
})

// @ts-expect-error -- Controlled bodies specialize Nuxt's generic validator contract.
vi.mock(import('nuxt/server'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,

    async readValidatedBody(event: nuxtServer.RequestEvent, validate: (body: unknown) => unknown) {
      await Promise.resolve()

      return validate(event.context.testBody)
    }
  }
})

let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null
let closeFailure: Error | null = null

function resources() {
  if (isolated === null) {
    throw new Error('Missing isolated PostgreSQL database')
  }

  return isolated
}

vi.mock(import('#server/utils/config'), () => {
  return {
    createRuntimeWebSocketClient() {
      const clientUrl = new globalThis.URL(resources().databaseUrl)

      clientUrl.searchParams.set('application_name', 'packing-clear-handler')

      const database = createWebSocketClient({
        databaseUrl: clientUrl.toString(),
        isLocalDatabase: true
      })

      if (closeFailure !== null) {
        const failure = closeFailure
        const end = database.$client.end.bind(database.$client)

        database.$client.end = async () => {
          const closed = end()

          return closed.then(() => { throw failure })
        }
      }

      return database
    }
  }
})

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) {
    throw new Error('Missing integration fixture')
  }

  return value
}

async function fixture() {
  const { database } = resources()
  const [ownerRow, otherRow] = await database.insert(users).values([{}, {}]).returning()
  const owner = required(ownerRow)
  const other = required(otherRow)

  // A future version makes each write prove strict millisecond monotonicity, not just wall-clock progress.
  const date = new Date('2090-01-01T00:00:00.000Z')

  const [listRow, secondRow, foreignRow] = await database.insert(packingLists).values([{
    name: 'Trip',
    userId: owner.id,
    createdAt: date,
    updatedAt: date
  }, {
    name: 'Another trip',
    userId: owner.id,
    createdAt: date,
    updatedAt: date
  }, {
    name: 'Foreign trip',
    userId: other.id,
    createdAt: date,
    updatedAt: date
  }]).returning()

  const list = required(listRow)
  const second = required(secondRow)
  const foreign = required(foreignRow)

  const [brandRow] = await database.insert(brands).values({
    name: `Brand ${list.id}`,
    slug: list.id
  }).returning()

  const [categoryRow] = await database.insert(equipmentCategories).values({
    name: `Category ${list.id}`,
    slug: list.id
  }).returning()

  const brand = required(brandRow)
  const category = required(categoryRow)

  const [itemRow] = await database.insert(equipmentItems).values({
    name: 'Catalog tent',
    brandId: brand.id,
    categoryId: category.id
  }).returning()

  const item = required(itemRow)

  const [catalogRow, privateRow] = await database.insert(userEquipment).values([{
    userId: owner.id,
    itemId: item.id
  }, {
    userId: owner.id,
    customName: 'Private stove'
  }]).returning()

  const catalog = required(catalogRow)
  const privateGear = required(privateRow)

  const inserted = await database.insert(packingListEntries).values([{
    packingListId: list.id,
    customName: 'Jacket',
    isPacked: true,
    createdAt: date,
    updatedAt: date
  }, {
    packingListId: list.id,
    userEquipmentId: catalog.id,
    isPacked: true,
    createdAt: date,
    updatedAt: date
  }, {
    packingListId: list.id,
    userEquipmentId: privateGear.id,
    isPacked: true,
    createdAt: date,
    updatedAt: date
  }, {
    packingListId: list.id,
    customName: 'Unpacked socks',
    isPacked: false,
    createdAt: date,
    updatedAt: date
  }, {
    packingListId: second.id,
    customName: 'Second jacket',
    isPacked: true,
    createdAt: date,
    updatedAt: date
  }, {
    packingListId: foreign.id,
    customName: 'Foreign jacket',
    isPacked: true,
    createdAt: date,
    updatedAt: date
  }]).returning()

  return {
    owner,
    other,
    list,
    second,
    foreign,
    entry: required(inserted[0]),
    socks: required(inserted[3])
  }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

function eventFor(data: Fixture, body?: unknown) {
  const { databaseUrl } = resources()
  const expectedUpdatedAt = data.list.updatedAt.toISOString()

  const database = createHttpClient({
    databaseUrl,
    isLocalDatabase: true
  })

  const event = createTestEvent(database)

  event.context.params = {
    id: data.list.id,
    entryId: data.entry.id
  }
  event.context.testUserId = data.owner.id
  event.context.testBody = body === undefined ? { expectedUpdatedAt } : body

  return event
}

async function entries(id: string) {
  return resources().database.select().from(packingListEntries).where(
    eq(packingListEntries.packingListId, id)
  ).orderBy(asc(packingListEntries.createdAt), asc(packingListEntries.id))
}

function updateVersion(value: Date | string) {
  return new Date(value).getTime()
}

function clearedEntry<Entry extends { isPacked: boolean; updatedAt: Date | string; }>(entry: Entry): Entry {
  if (!entry.isPacked) {
    return entry
  }

  return {
    ...entry,
    isPacked: false,
    updatedAt: new Date('2090-01-01T00:00:00.001Z')
  }
}

function refusedEvent(data: Fixture, access: 'foreign' | 'missing' | 'invalid' | 'anonymous') {
  const event = eventFor(data)

  if (access === 'foreign') {
    event.context.testUserId = data.other.id
  } else if (access === 'missing') {
    event.context.params = { id: data.owner.id }
  } else if (access === 'invalid') {
    event.context.params = { id: 'invalid' }
  } else {
    event.context.testUserId = null
  }

  return event
}

async function runRace(change: 'pack' | 'add' | 'remove', resetFirst: boolean) {
  const data = await fixture()
  const { database, rootDatabase } = resources()
  const before = await entries(data.list.id)
  const schema = await database.execute<{ name: string; }>(sql`SELECT current_schema() AS name`)
  const schemaName = required(schema.rows[0]).name
  const locked = Promise.withResolvers<boolean>()
  const release = Promise.withResolvers<boolean>()

  await database.execute(sql`CREATE FUNCTION pause_entry_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext(current_schema()), 793);
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$`)

  await database.execute(sql`CREATE TRIGGER pause_entry_write BEFORE INSERT OR UPDATE OR DELETE ON packing_list_entries FOR EACH ROW EXECUTE FUNCTION pause_entry_write()`)

  const holder = rootDatabase.transaction(async transaction => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${schemaName}), 793)`)
    locked.resolve(true)

    await release.promise
  })

  await locked.promise

  async function mutate() {
    if (change === 'pack') {
      const event = eventFor(data, { isPacked: true })

      // The unpacked entry gives both orderings a visible, distinct result.
      event.context.params = {
        id: data.list.id,
        entryId: data.socks.id
      }

      const result = await packEntry(event)

      return result.packingListUpdatedAt
    }

    if (change === 'add') {
      const result = await addEntry(eventFor(data, { customName: 'Added item' }))

      return result.packingListUpdatedAt
    }

    const result = await removeEntry(eventFor(data))

    return result.packingListUpdatedAt
  }

  const first = resetFirst ? clearPacked(eventFor(data)) : mutate()
  let second: ReturnType<typeof clearPacked> | ReturnType<typeof mutate> | null = null

  try {
    await expect.poll(async () => {
      const locks = await rootDatabase.execute(sql`SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = hashtext(${schemaName})::bit(32)::bigint AND objid = 793 AND NOT granted`)

      return locks.rows.length
    }).toBe(1)

    second = resetFirst ? mutate() : clearPacked(eventFor(data))

    // The second handler must wait at the parent SELECT, before touching any entry.
    await expect.poll(async () => {
      const waiting = await rootDatabase.execute(sql`
        SELECT 1 FROM pg_stat_activity
        WHERE wait_event_type = 'Lock' AND query LIKE '%packing_lists%for update%'
          AND application_name = 'packing-clear-handler'
      `)

      return waiting.rows.length
    }).toBe(1)

    release.resolve(true)

    const firstResult = await first
    const secondResult = await second
    const reset = resetFirst ? firstResult : secondResult
    const mutationVersion = resetFirst ? secondResult : firstResult

    if (reset instanceof Date || typeof reset === 'string' || (typeof mutationVersion !== 'string' && !(mutationVersion instanceof Date))) {
      throw new Error('Unexpected concurrency result')
    }

    const detail = reset.packingList

    expect(reset.outcome).toBe(resetFirst ? 'cleared' : 'conflict')
    expect(detail.entries.every(entry => !entry.isPacked)).toBe(resetFirst)

    const persisted = await entries(data.list.id)
    const resetVersion = updateVersion(detail.updatedAt)
    const changeVersion = updateVersion(mutationVersion)
    const firstVersion = resetFirst ? resetVersion : changeVersion
    const secondVersion = resetFirst ? changeVersion : resetVersion
    const expectedVersionDifference = resetFirst ? 1 : 0

    expect(secondVersion - firstVersion).toBe(expectedVersionDifference)

    const retained = before.filter(entry => change !== 'remove' || entry.id !== data.entry.id)

    const expected = retained.map(entry => {
      const packedByMutation = change === 'pack' && entry.id === data.socks.id
      const changedByReset = resetFirst && entry.isPacked
      const resetUpdatedAt = changedByReset ? new Date(resetVersion) : entry.updatedAt
      const updatedAt = packedByMutation ? new Date(changeVersion) : resetUpdatedAt

      return {
        id: entry.id,
        packingListId: entry.packingListId,
        customName: entry.customName,
        userEquipmentId: entry.userEquipmentId,
        isPacked: packedByMutation || (!resetFirst && entry.isPacked),
        createdAt: entry.createdAt,
        updatedAt
      }
    })

    const retainedPersisted = persisted.filter(entry => entry.customName !== 'Added item')

    expect(retainedPersisted).toStrictEqual(expected)

    return {
      firstVersion,
      secondVersion,
      resetCount: detail.entries.length,
      persistedCount: persisted.length,
      socksPacked: persisted.find(entry => entry.id === data.socks.id)?.isPacked,
      addedInReset: detail.entries.some(entry => entry.customName === 'Added item'),
      targetInReset: detail.entries.some(entry => entry.id === data.entry.id)
    }
  } finally {
    release.resolve(true)
    await Promise.allSettled([holder, first, second])
    await database.execute(sql`DROP TRIGGER pause_entry_write ON packing_list_entries`)
    await database.execute(sql`DROP FUNCTION pause_entry_write()`)
  }
}

type RecoveryOrdering = 'recovery before delayed original' | 'original committed before replay'

async function runRecoveryRace(ordering: RecoveryOrdering) {
  const data = await fixture()
  const { database } = resources()
  const originalEvent = eventFor(data)
  const releaseOriginal = Promise.withResolvers<boolean>()
  const recoveryFirst = ordering === 'recovery before delayed original'

  if (recoveryFirst) {
    requestGates.set(originalEvent, releaseOriginal.promise)
  }

  const original = clearPacked(originalEvent)

  try {
    const recoveryEvent = eventFor(data)
    const firstReset = recoveryFirst ? await clearPacked(recoveryEvent) : await original
    const addEvent = eventFor(data, { customName: 'Packed after recovery' })
    const added = await addEntry(addEvent)
    const packEvent = eventFor(data, { isPacked: true })

    packEvent.context.params = {
      id: data.list.id,
      entryId: added.entry.id
    }

    const packed = await packEntry(packEvent)
    const before = await entries(data.list.id)
    const detailEvent = eventFor(data)
    const detail = await getList(detailEvent)
    const parent = await database.query.packingLists.findFirst({ where: { id: data.list.id } })
    const packedVersion = updateVersion(packed.packingListUpdatedAt)
    const resetVersion = updateVersion(firstReset.packingList.updatedAt)
    const newlyPackedEntry = before.find(entry => entry.id === added.entry.id)

    releaseOriginal.resolve(true)

    // A lost response must not make a retry replace its original expected version with the newer one.
    const replayEvent = eventFor(data)
    const replay = recoveryFirst ? await original : await clearPacked(replayEvent)
    const after = await entries(data.list.id)
    const updatedParent = await database.query.packingLists.findFirst({ where: { id: data.list.id } })

    return {
      firstReset,
      newlyPackedEntry,
      packedVersion,
      resetVersion,
      replay,
      detail,
      after,
      before,
      updatedParent,
      parent
    }
  } finally {
    releaseOriginal.resolve(true)
    requestGates.delete(originalEvent)
    await Promise.allSettled([original])
  }
}

describe('clearing packed marks through real handlers on PostgreSQL', () => {
  beforeAll(async () => {
    isolated = await createIsolatedPostgreSQL('packing_clear', { httpAccess: true })
  })

  afterAll(async () => {
    await isolated?.dispose()
  })

  it('preserves every source and other lists, changes only packed rows and dates, and keeps GET wire shape', async () => {
    const data = await fixture()
    const { database } = resources()
    const before = await entries(data.list.id)
    const gear = await database.select().from(userEquipment)
    const second = await entries(data.second.id)
    const foreign = await entries(data.foreign.id)
    const detail = await getList(eventFor(data))
    const result = await clearPacked(eventFor(data))
    const after = await entries(data.list.id)

    expect(result).toStrictEqual({
      outcome: 'cleared',

      packingList: {
        ...detail,
        updatedAt: new Date('2090-01-01T00:00:00.001Z'),
        entries: detail.entries.map(entry => clearedEntry(entry))
      }
    })

    expect(after).toStrictEqual(before.map(entry => clearedEntry(entry)))
    await expect(getList(eventFor(data))).resolves.toStrictEqual(result.packingList)
    await expect(entries(data.second.id)).resolves.toStrictEqual(second)
    await expect(entries(data.foreign.id)).resolves.toStrictEqual(foreign)
    await expect(database.select().from(userEquipment)).resolves.toStrictEqual(gear)

    await expect(database.query.packingLists.findFirst({ where: { id: data.list.id } })).resolves.toStrictEqual({
      ...data.list,
      updatedAt: result.packingList.updatedAt
    })

    // A stale retry conflicts, while a matching retry and an empty reset remain exact timestamp no-ops.
    const staleRetryEvent = eventFor(data)

    await expect(clearPacked(staleRetryEvent)).resolves.toStrictEqual({
      packingList: result.packingList,
      outcome: 'conflict'
    })

    const retryUpdatedAt = new Date(result.packingList.updatedAt)
    const retryExpectedUpdatedAt = retryUpdatedAt.toISOString()
    const retryEvent = eventFor(data, { expectedUpdatedAt: retryExpectedUpdatedAt })

    await expect(clearPacked(retryEvent)).resolves.toStrictEqual(result)
    await expect(entries(data.list.id)).resolves.toStrictEqual(after)

    const emptyExpectedUpdatedAt = data.second.updatedAt.toISOString()
    const emptyEvent = eventFor(data, { expectedUpdatedAt: emptyExpectedUpdatedAt })

    await database.delete(packingListEntries).where(
      eq(packingListEntries.packingListId, data.second.id)
    )

    emptyEvent.context.params = { id: data.second.id }

    await expect(clearPacked(emptyEvent)).resolves.toStrictEqual({
      outcome: 'cleared',

      packingList: {
        createdAt: data.second.createdAt,
        entries: [],
        id: data.second.id,
        name: data.second.name,
        updatedAt: data.second.updatedAt
      }
    })
  })

  it.each([
    undefined,
    null,
    {},
    { expectedUpdatedAt: 'invalid' },
    { expectedUpdatedAt: '2090-01-01' },
    { expectedUpdatedAt: 1 }
  ])('rejects an invalid reset body %j without changing entries or list dates', async body => {
    const data = await fixture()
    const { database } = resources()
    const before = await entries(data.list.id)
    const event = eventFor(data)

    event.context.testBody = body

    await expect(clearPacked(event)).rejects.toBeInstanceOf(v.ValiError)
    await expect(entries(data.list.id)).resolves.toStrictEqual(before)
    await expect(database.query.packingLists.findFirst({ where: { id: data.list.id } })).resolves.toStrictEqual(data.list)
  })

  it.each([['foreign', 404], ['missing', 404], ['invalid', 400], ['anonymous', 401]] as const)('rejects %s access without changing entries', async (access, status) => {
    const data = await fixture()
    const event = refusedEvent(data, access)
    const before = await entries(data.list.id)

    await expect(clearPacked(event)).rejects.toMatchObject({ statusCode: status })
    await expect(entries(data.list.id)).resolves.toStrictEqual(before)
  })

  it('returns current detail without writes when the expected version is newer than the stored version', async () => {
    const data = await fixture()
    const { database } = resources()
    const before = await entries(data.list.id)
    const detailEvent = eventFor(data)
    const detail = await getList(detailEvent)
    const currentVersion = data.list.updatedAt.getTime()
    const futureVersion = new Date(currentVersion + 1)
    const expectedUpdatedAt = futureVersion.toISOString()
    const event = eventFor(data, { expectedUpdatedAt })

    await expect(clearPacked(event)).resolves.toStrictEqual({
      packingList: detail,
      outcome: 'conflict'
    })

    await expect(entries(data.list.id)).resolves.toStrictEqual(before)
    await expect(database.query.packingLists.findFirst({ where: { id: data.list.id } })).resolves.toStrictEqual(data.list)
  })

  it('rolls back entry updates when touching the parent fails and logs the raw error safely', async () => {
    const data = await fixture()
    const { database } = resources()
    const before = await entries(data.list.id)

    const log = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {
      // Verify telemetry below without printing the expected database failure.
    })

    await database.execute(sql`CREATE FUNCTION reject_clear_parent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private database failure'; END $$`)
    await database.execute(sql`CREATE TRIGGER reject_clear_parent BEFORE UPDATE ON packing_lists FOR EACH ROW EXECUTE FUNCTION reject_clear_parent()`)

    onTestFinished(async () => {
      await database.execute(sql`DROP TRIGGER reject_clear_parent ON packing_lists`)
      await database.execute(sql`DROP FUNCTION reject_clear_parent()`)
      log.mockRestore()
    })

    await expect(clearPacked(eventFor(data))).rejects.toMatchObject({
      statusCode: 500,
      message: 'Could not clear packed marks'
    })

    await expect(entries(data.list.id)).resolves.toStrictEqual(before)
    await expect(database.query.packingLists.findFirst({ where: { id: data.list.id } })).resolves.toStrictEqual(data.list)

    const rawFailure: unknown = expect.objectContaining({ cause: expect.objectContaining({ message: 'private database failure' }) as unknown })

    expect(log).toHaveBeenCalledWith('Failed to clear packed marks', rawFailure)
  })

  it('does not turn a committed reset into a failure when closing the client fails', async () => {
    const data = await fixture()

    const log = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {
      // Verify the close failure is telemetry, not a failed reset.
    })

    const failure = new Error('Simulated client close failure')

    closeFailure = failure

    onTestFinished(() => {
      closeFailure = null

      log.mockRestore()
    })

    const result = await clearPacked(eventFor(data))

    expect(result.outcome).toBe('cleared')
    expect(result.packingList.entries.every(entry => !entry.isPacked)).toBe(true)
    expect(log).toHaveBeenCalledWith('Failed to close packing list database client', failure)

    const persisted = await entries(data.list.id)

    expect(persisted.every(entry => !entry.isPacked)).toBe(true)
  })

  it.each([{
    change: 'pack',
    resetFirst: true,

    expected: {
      resetCount: 4,
      persistedCount: 4,
      socksPacked: true,
      addedInReset: false,
      targetInReset: true
    }
  }, {
    change: 'pack',
    resetFirst: false,

    expected: {
      resetCount: 4,
      persistedCount: 4,
      socksPacked: true,
      addedInReset: false,
      targetInReset: true
    }
  }, {
    change: 'add',
    resetFirst: true,

    expected: {
      resetCount: 4,
      persistedCount: 5,
      socksPacked: false,
      addedInReset: false,
      targetInReset: true
    }
  }, {
    change: 'add',
    resetFirst: false,

    expected: {
      resetCount: 5,
      persistedCount: 5,
      socksPacked: false,
      addedInReset: true,
      targetInReset: true
    }
  }, {
    change: 'remove',
    resetFirst: true,

    expected: {
      resetCount: 4,
      persistedCount: 3,
      socksPacked: false,
      addedInReset: false,
      targetInReset: true
    }
  }, {
    change: 'remove',
    resetFirst: false,

    expected: {
      resetCount: 3,
      persistedCount: 3,
      socksPacked: false,
      addedInReset: false,
      targetInReset: false
    }
  }] as const)('serializes $change with reset first=$resetFirst using actual handler locks and PostgreSQL barriers', async ({ change, resetFirst, expected }) => {
    const observed = await runRace(change, resetFirst)

    expect(observed).toMatchObject(expected)
  })

  it.each(['recovery before delayed original', 'original committed before replay'] as const)('preserves newer packed entries with %s using the same expected version', async ordering => {
    const observed = await runRecoveryRace(ordering)

    expect(observed.firstReset.outcome).toBe('cleared')
    expect(observed.firstReset.packingList.entries.every(entry => !entry.isPacked)).toBe(true)
    expect(observed.newlyPackedEntry?.isPacked).toBe(true)
    expect(observed.packedVersion).toBeGreaterThan(observed.resetVersion)

    expect(observed.replay).toStrictEqual({
      packingList: observed.detail,
      outcome: 'conflict'
    })

    expect(observed.after).toStrictEqual(observed.before)
    expect(observed.updatedParent).toStrictEqual(observed.parent)
  })

  it('keeps rename versions newer than a confirmed reset at millisecond precision', async () => {
    const data = await fixture()
    const reset = await clearPacked(eventFor(data))
    const renamed = await renameList(eventFor(data, { name: 'Next trip' }))

    expect(updateVersion(renamed.updatedAt)).toBeGreaterThan(updateVersion(reset.packingList.updatedAt))
    expect(renamed.name).toBe('Next trip')

    const stored = await entries(data.list.id)

    expect(stored.every(entry => !entry.isPacked)).toBe(true)
    expect(stored.find(entry => entry.id === data.socks.id)).toStrictEqual(data.socks)
  })
})
