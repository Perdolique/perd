import { and, asc, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  brands,
  equipmentCategories,
  equipmentItems,
  packingListEntries,
  packingLists,
  userEquipment,
  users
} from '#server/database/schema'

import { copyPackingList } from '#server/utils/packing-list-copy'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

type IsolatedDatabase = Awaited<ReturnType<typeof createIsolatedPostgreSQL>>

function required<Value>(value: Value | undefined | null): Value {
  if (value === undefined || value === null) {
    throw new Error('Missing integration fixture')
  }

  return value
}

let isolated: IsolatedDatabase | null = null

async function fixture() {
  const { database } = required(isolated)
  const [ownerRow, otherRow] = await database.insert(users).values([{}, {}]).returning()
  const owner = required(ownerRow)
  const other = required(otherRow)
  const originalDate = new Date('2021-01-01')
  const laterEntryDate = new Date('2021-01-02')

  const [listRow] = await database.insert(packingLists).values({
    userId: owner.id,
    name: 'Original trip',
    createdAt: originalDate,
    updatedAt: originalDate
  }).returning()

  const list = required(listRow)

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
  const entryIds = await database.execute<{ id: string; }>(sql`SELECT uuidv7() AS id FROM generate_series(1, 2) ORDER BY id`)
  const earlierEntryId = required(entryIds.rows[0]).id
  const laterEntryId = required(entryIds.rows[1]).id

  // The tied rows have the opposite ID and insertion order, so the secondary sort matters.
  await database.insert(packingListEntries).values([{
    packingListId: list.id,
    userEquipmentId: privateGear.id,
    isPacked: true,
    createdAt: laterEntryDate,
    updatedAt: originalDate
  }, {
    id: laterEntryId,
    packingListId: list.id,
    userEquipmentId: catalog.id,
    isPacked: false,
    createdAt: originalDate,
    updatedAt: originalDate
  }, {
    id: earlierEntryId,
    packingListId: list.id,
    customName: 'Rain jacket',
    isPacked: true,
    createdAt: originalDate,
    updatedAt: originalDate
  }])

  return {
    owner,
    other,
    list,
    privateGear
  }
}

async function entries(id: string) {
  const { database } = required(isolated)

  return database.select().from(packingListEntries)
    .where(
      eq(packingListEntries.packingListId, id)
    )
    .orderBy(asc(packingListEntries.createdAt), asc(packingListEntries.id))
}

async function observeDeletionRace(result: PromiseSettledResult<Awaited<ReturnType<typeof copyPackingList>>>, userId: string) {
  const { database } = required(isolated)
  const remaining = await database.query.packingLists.findMany({ where: { userId } })

  if (result.status === 'fulfilled') {
    const copiedEntries = await entries(result.value.id)

    return {
      status: 201,
      entryCount: copiedEntries.length,
      packedCount: result.value.packedCount,
      listCount: remaining.length
    }
  }

  const error: unknown = result.reason
  let status: unknown = null

  if (typeof error === 'object' && error !== null) {
    status = Reflect.get(error, 'statusCode')

    const cause: unknown = Reflect.get(error, 'cause')

    if (typeof cause === 'object' && cause !== null && Reflect.get(cause, 'code') === '40001') {
      status = 409
    }
  }

  return {
    status,
    entryCount: 0,
    packedCount: 0,
    listCount: remaining.length
  }
}

describe('packing list copy persistence', () => {
  beforeAll(async () => {
    isolated = await createIsolatedPostgreSQL('packing_list_copy')
  })

  afterAll(async () => {
    await isolated?.dispose()
  })

  it('copies a mixed guest-owned list in display order with new IDs, shared gear, and independent unpacked entries', async () => {
    const { database } = required(isolated)
    const data = await fixture()
    const originalEntries = await entries(data.list.id)
    const savedGear = await database.query.userEquipment.findMany({ where: { userId: data.owner.id } })

    const copy = await copyPackingList(database, {
      userId: data.owner.id,
      id: data.list.id,
      name: data.list.name
    })

    const copiedEntries = await entries(copy.id)
    const originalIds = new Set(originalEntries.map(row => row.id))
    const copiedIds = copiedEntries.map(row => row.id)
    const copiedSources = copiedEntries.map(row => [row.customName, row.userEquipmentId])
    const originalSources = originalEntries.map(row => [row.customName, row.userEquipmentId])

    expect(copy.id).not.toBe(data.list.id)

    expect(copy).toMatchObject({
      entryCount: 3,
      packedCount: 0,
      name: data.list.name
    })

    expect(copiedSources).toStrictEqual(originalSources)
    expect(copiedEntries.every(row => !row.isPacked)).toBe(true)

    const sharedIds = copiedIds.filter(id => originalIds.has(id))
    const versions = copiedIds.map(id => id[14])

    expect(sharedIds).toStrictEqual([])
    expect(versions).toStrictEqual(['7', '7', '7'])
    expect(copiedEntries.every(row => row.createdAt > data.list.createdAt)).toBe(true)

    const copyCreatedAt = copy.createdAt.getTime()
    const copyUpdatedAt = copy.updatedAt.getTime()
    const originalCreatedAt = data.list.createdAt.getTime()
    const originalUpdatedAt = data.list.updatedAt.getTime()

    expect(copyCreatedAt).toBeGreaterThan(originalCreatedAt)
    expect(copyUpdatedAt).toBeGreaterThan(originalUpdatedAt)
    expect(copiedEntries.every(row => row.updatedAt > data.list.updatedAt)).toBe(true)

    const persistedCopy = await database.query.packingLists.findFirst({ where: { id: copy.id } })

    expect(persistedCopy?.createdAt).toStrictEqual(copy.createdAt)
    expect(persistedCopy?.updatedAt).toStrictEqual(copy.updatedAt)
    await expect(entries(data.list.id)).resolves.toStrictEqual(originalEntries)
    await expect(database.query.packingLists.findFirst({ where: { id: data.list.id } })).resolves.toStrictEqual(data.list)
    await expect(database.query.userEquipment.findMany({ where: { userId: data.owner.id } })).resolves.toStrictEqual(savedGear)

    const firstCopy = required(copiedEntries[0])
    const secondCopy = required(copiedEntries[1])

    await database.update(packingListEntries).set({ isPacked: true }).where(
      eq(packingListEntries.id, firstCopy.id)
    )

    await database.delete(packingListEntries).where(
      eq(packingListEntries.id, secondCopy.id)
    )

    await expect(entries(data.list.id)).resolves.toStrictEqual(originalEntries)

    await database.update(userEquipment).set({ customName: 'Updated private stove' }).where(
      eq(userEquipment.id, data.privateGear.id)
    )

    const references = await database.select({
      listId: packingListEntries.packingListId,
      name: userEquipment.customName
    })
      .from(packingListEntries).innerJoin(userEquipment, eq(packingListEntries.userEquipmentId, userEquipment.id))
      .where(
        eq(userEquipment.id, data.privateGear.id)
      )

    expect(references).toHaveLength(2)
    expect(references.every(row => row.name === 'Updated private stove')).toBe(true)
  })

  it('copies an empty list and rejects missing or foreign originals', async () => {
    const data = await fixture()
    const { database } = required(isolated)

    await database.delete(packingListEntries).where(
      eq(packingListEntries.packingListId, data.list.id)
    )

    const copy = await copyPackingList(database, {
      userId: data.owner.id,
      id: data.list.id,
      name: 'Empty copy'
    })

    expect(copy).toMatchObject({
      entryCount: 0,
      packedCount: 0
    })

    await expect(entries(copy.id)).resolves.toStrictEqual([])

    await expect(copyPackingList(database, {
      userId: data.other.id,
      id: data.list.id,
      name: 'Foreign'
    })).rejects.toMatchObject({ statusCode: 404 })

    await expect(copyPackingList(database, {
      userId: data.owner.id,
      id: data.owner.id,
      name: 'Missing'
    })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects a foreign saved-gear reference without leaving a copy', async () => {
    const data = await fixture()
    const { database } = required(isolated)

    await database.update(userEquipment).set({ userId: data.other.id }).where(
      eq(userEquipment.id, data.privateGear.id)
    )

    await expect(copyPackingList(database, {
      userId: data.owner.id,
      id: data.list.id,
      name: 'Unavailable copy'
    })).rejects.toMatchObject({ statusCode: 409 })

    await expect(database.query.packingLists.findMany({ where: { userId: data.owner.id } })).resolves.toStrictEqual([data.list])
  })

  it('rolls back the new list when inserting its entries fails', async () => {
    const data = await fixture()
    const { database } = required(isolated)

    await database.execute(sql`
      CREATE FUNCTION fail_copy_entries() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM packing_lists WHERE id = NEW."packingListId" AND name = 'Failing copy') THEN
          RAISE EXCEPTION 'Simulated entry write failure';
        END IF;
        RETURN NEW;
      END $$
    `)

    await database.execute(sql`CREATE TRIGGER fail_copy_entries BEFORE INSERT ON packing_list_entries FOR EACH ROW EXECUTE FUNCTION fail_copy_entries()`)

    try {
      await expect(copyPackingList(database, {
        userId: data.owner.id,
        id: data.list.id,
        name: 'Failing copy'
      })).rejects.toMatchObject({ cause: { message: 'Simulated entry write failure' } })

      await expect(database.query.packingLists.findMany({ where: { userId: data.owner.id } })).resolves.toStrictEqual([data.list])
      await expect(entries(data.list.id)).resolves.toHaveLength(3)
    } finally {
      await database.execute(sql`DROP TRIGGER fail_copy_entries ON packing_list_entries`)
      await database.execute(sql`DROP FUNCTION fail_copy_entries()`)
    }
  })

  it('uses one snapshot when original entries change after copying has begun', async () => {
    const data = await fixture()
    const { database, rootDatabase } = required(isolated)
    const originalEntries = await entries(data.list.id)
    const schemaResult = await database.execute<{ name: string; }>(sql`SELECT current_schema() AS name`)
    const schemaName = required(schemaResult.rows[0]).name
    const { promise: release, resolve: releaseLock } = Promise.withResolvers<null>()
    const { promise: locked, resolve: signalLock } = Promise.withResolvers<null>()

    await database.execute(sql`
      CREATE FUNCTION pause_copy_list() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.name = 'Paused copy' THEN
          PERFORM pg_advisory_xact_lock(hashtext(current_schema()), 792);
        END IF;
        RETURN NEW;
      END $$
    `)

    await database.execute(sql`CREATE TRIGGER pause_copy_list AFTER INSERT ON packing_lists FOR EACH ROW EXECUTE FUNCTION pause_copy_list()`)

    const holder = rootDatabase.transaction(async transaction => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${schemaName}), 792)`)
      signalLock(null)

      await release
    })

    await locked

    const copying = copyPackingList(database, {
      userId: data.owner.id,
      id: data.list.id,
      name: 'Paused copy'
    })

    try {
      await expect.poll(async () => {
        const locks = await rootDatabase.execute(sql`SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = hashtext(${schemaName})::bit(32)::bigint AND objid = 792 AND NOT granted`)

        return locks.rows.length
      }).toBe(1)

      await database.update(packingListEntries).set({
        isPacked: false,
        customName: 'Changed jacket'
      }).where(
        and(
          eq(packingListEntries.packingListId, data.list.id),
          sql`${packingListEntries.customName} is not null`
        )
      )

      await database.insert(packingListEntries).values({
        packingListId: data.list.id,
        customName: 'Late item'
      })

      releaseLock(null)

      const copy = await copying
      const copiedEntries = await entries(copy.id)
      const copiedSources = copiedEntries.map(row => [row.customName, row.userEquipmentId])
      const originalSources = originalEntries.map(row => [row.customName, row.userEquipmentId])

      expect(copiedSources).toStrictEqual(originalSources)
      expect(copy.entryCount).toBe(3)
    } finally {
      releaseLock(null)
      await Promise.allSettled([holder, copying])
      await database.execute(sql`DROP TRIGGER pause_copy_list ON packing_lists`)
      await database.execute(sql`DROP FUNCTION pause_copy_list()`)
    }
  })

  it('copies a complete snapshot or refuses when the original is deleted concurrently', async () => {
    const data = await fixture()
    const { database } = required(isolated)

    const copying = copyPackingList(database, {
      userId: data.owner.id,
      id: data.list.id,
      name: 'Delete race copy'
    })

    const deleting = database.delete(packingLists).where(
      eq(packingLists.id, data.list.id)
    )

    const [result] = await Promise.allSettled([copying, deleting])
    const observed = await observeDeletionRace(result, data.owner.id)

    expect([
      {
        status: 201,
        entryCount: 3,
        packedCount: 0,
        listCount: 1
      },
      {
        status: 404,
        entryCount: 0,
        packedCount: 0,
        listCount: 0
      },
      {
        status: 409,
        entryCount: 0,
        packedCount: 0,
        listCount: 0
      }
    ]).toContainEqual(observed)
  })
})
