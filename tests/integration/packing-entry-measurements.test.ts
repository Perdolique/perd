// oxlint-disable-next-line typescript/triple-slash-reference -- Real handlers require the generated Worker globals.
/// <reference path="../../server/types/worker-configuration.d.ts" />
import { readFile } from 'node:fs/promises'
import { eq, sql } from 'drizzle-orm'
import type * as nuxtServer from 'nuxt/server'
import { createError } from 'nuxt/server'
import * as v from 'valibot'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  brands,
  categoryProperties,
  equipmentCategories,
  equipmentItems,
  itemPropertyValues,
  packingListEntries,
  packingLists,
  userEquipment,
  users
} from '#server/database/schema'

import { createWebSocketClient } from '#server/utils/database'
import { readPackingListDetail } from '#server/utils/packing-list-detail'
import { copyPackingList } from '#server/utils/packing-list-copy'
import addEntry from '#server/api/user/packing-lists/[id]/entries/index.post'
import editEntry from '#server/api/user/packing-lists/[id]/entries/[entry-id].patch'
import clearPacked from '#server/api/user/packing-lists/[id]/clear-packed.post'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'
import { createTestEvent } from '../../test-utils/create-test-event'

vi.mock(import('#server/utils/session'), () => {
  return { async validateSessionUser(event: nuxtServer.RequestEvent) {
      await Promise.resolve()

      return v.parse(v.string(), event.context.testUserId)
    } }
})

// @ts-expect-error -- Controlled request bodies specialize the generic validator.
vi.mock(import('nuxt/server'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,

    async readValidatedBody(event: nuxtServer.RequestEvent, validate: (body: unknown) => unknown) {
      await Promise.resolve()

      try {
        return validate(event.context.testBody)
      } catch {
        throw createError({ status: 400 })
      }
    }
  }
})

let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null
const migrationName = '20261017185756_packing-quantities-and-weights'

function resources() {
  if (isolated === null) { throw new Error('Missing isolated database') }

  return isolated
}

vi.mock(import('#server/utils/config'), () => {
  return {
    createRuntimeWebSocketClient() {
      return createWebSocketClient({
        databaseUrl: resources().databaseUrl,
        isLocalDatabase: true
      })
    }
  }
})

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) { throw new Error('Missing fixture') }

  return value
}
async function fixture() {
  const { database } = resources()
  const [ownerRow, otherRow] = await database.insert(users).values([{}, {}]).returning()
  const owner = required(ownerRow)
  const other = required(otherRow)

  const [listRow] = await database.insert(packingLists).values({
    userId: owner.id,
    name: 'Trip'
  }).returning()

  const list = required(listRow)

  const [brandRow] = await database.insert(brands).values({
    name: list.id,
    slug: list.id
  }).returning()

  const brand = required(brandRow)

  const [categoryRow] = await database.insert(equipmentCategories).values({
    name: list.id,
    slug: list.id
  }).returning()

  const category = required(categoryRow)

  const [itemRow] = await database.insert(equipmentItems).values({
    name: 'Tent',
    brandId: brand.id,
    categoryId: category.id
  }).returning()

  const item = required(itemRow)

  const [propertyRow] = await database.insert(categoryProperties).values({
    categoryId: category.id,
    name: 'Weight',
    slug: 'weight',
    dataType: 'number',
    unit: 'g',
    displayOrder: 0
  }).returning()

  const property = required(propertyRow)

  await database.insert(itemPropertyValues).values({
    itemId: item.id,
    propertyId: property.id,
    valueNumber: '123.456789'
  })

  const [catalogRow, privateRow] = await database.insert(userEquipment).values([
    {
      userId: owner.id,
      itemId: item.id,
      measuredWeightGrams: '0',
      ownedQuantity: 1
    },
    {
      userId: owner.id,
      customName: 'Private stove',
      measuredWeightGrams: '12.00000000000000000001'
    }
  ]).returning()

  const catalog = required(catalogRow)
  const privateGear = required(privateRow)

  const [textRow] = await database.insert(packingListEntries).values({
    packingListId: list.id,
    customName: 'Borrowed mug',
    isPacked: true
  }).returning()

  const text = required(textRow)

  return {
    owner,
    other,
    list,
    item,
    property,
    catalog,
    privateGear,
    text
  }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

function eventFor(data: Fixture, body: unknown, entryId = data.text.id) {
  const event = createTestEvent(resources().database)

  event.context.params = {
    id: data.list.id,
    entryId
  }
  event.context.testUserId = data.owner.id
  event.context.testBody = body

  return event
}

function savedGearEntry(detail: Awaited<ReturnType<typeof readPackingListDetail>>, inventoryId: string) {
  return detail.entries.find(entry => entry.source === 'inventory' && entry.inventory.inventoryId === inventoryId)
}

describe('packing quantities and weight persistence', () => {
  beforeAll(async () => {
    isolated = await createIsolatedPostgreSQL('packing_measurements', { beforeMigration: migrationName })
  })

  afterAll(async () => { await isolated?.dispose() })

  it('migrates existing text and saved-gear rows with defaults and keeps references and packed marks', async () => {
    const { database } = resources()
    const [ownerRow] = await database.insert(users).values({}).returning()
    const owner = required(ownerRow)

    const [listRow] = await database.insert(packingLists).values({
      name: 'Legacy',
      userId: owner.id
    }).returning()

    const list = required(listRow)

    const [gearRow] = await database.insert(userEquipment).values({
      userId: owner.id,
      customName: 'Legacy private'
    }).returning()

    const gear = required(gearRow)

    await database.execute(sql`INSERT INTO packing_list_entries ("packingListId", "customName", "isPacked") VALUES (${list.id}, 'Legacy text', true)`)
    await database.execute(sql`INSERT INTO packing_list_entries ("packingListId", "userEquipmentId", "isPacked") VALUES (${list.id}, ${gear.id}, true)`)

    const before = await database.execute(sql`SELECT id, "userEquipmentId", "isPacked", "createdAt", "updatedAt" FROM packing_list_entries ORDER BY id`)
    const migration = await readFile(new globalThis.URL(`../../server/database/migrations/${migrationName}/migration.sql`, import.meta.url), 'utf8')

    await database.execute(sql.raw(migration))

    const after = await database.execute(sql`SELECT id, "userEquipmentId", "isPacked", "createdAt", "updatedAt" FROM packing_list_entries ORDER BY id`)

    expect(after.rows).toStrictEqual(before.rows)

    const rows = await database.select().from(packingListEntries)

    expect(rows.map(row => [row.quantity, row.customWeightGrams])).toStrictEqual([[1, null], [1, null]])
  })

  it('preserves exact custom weight, partial fields, packed marks and list versions, then copies them independently', async () => {
    const data = await fixture()
    const { database } = resources()
    const precise = '98765432109876543210.12345678901234567890123456789'

    const saved = await editEntry(eventFor(data, {
      quantity: 2_147_483_647,
      weightGrams: precise
    }))

    expect(saved.entry).toMatchObject({
      quantity: 2_147_483_647,
      weightGrams: precise,
      weightSource: 'custom',
      isPacked: true
    })

    expect(new Date(saved.packingListUpdatedAt).getTime()).toBeGreaterThan(data.list.updatedAt.getTime())

    const packedOnly = await editEntry(eventFor(data, { isPacked: false }))

    expect(packedOnly.entry).toMatchObject({
      quantity: 2_147_483_647,
      weightGrams: precise,
      isPacked: false
    })

    const quantityOnly = await editEntry(eventFor(data, { quantity: 3 }))

    expect(quantityOnly.entry).toMatchObject({
      quantity: 3,
      weightGrams: precise,
      isPacked: false
    })

    const stored = await database.query.packingListEntries.findFirst({ where: { id: data.text.id } })

    expect(stored?.customWeightGrams).toBe(precise)

    const copied = await copyPackingList(database, {
      id: data.list.id,
      userId: data.owner.id,
      name: 'Copy'
    })

    const detail = await readPackingListDetail(database, copied.id, data.owner.id)

    expect(detail.entries[0]).toMatchObject({
      quantity: 3,
      weightGrams: precise,
      isPacked: false
    })

    await editEntry(eventFor(data, {
      quantity: 4,
      weightGrams: '0'
    }))

    const independentCopy = await readPackingListDetail(database, copied.id, data.owner.id)

    expect(independentCopy.entries[0]).toMatchObject({
      quantity: 3,
      weightGrams: precise
    })

    const zeroWeight = await editEntry(eventFor(data, { weightGrams: '0' }))

    expect(zeroWeight.entry).toMatchObject({
      weightGrams: '0',
      weightSource: 'custom'
    })

    const clearedWeight = await editEntry(eventFor(data, { weightGrams: null }))

    expect(clearedWeight.entry).toMatchObject({
      weightGrams: null,
      weightSource: null,
      quantity: 4
    })
  })

  it('resolves zero measured weight before catalog, reads live changes in batches, and never accepts saved-gear weight edits', async () => {
    const data = await fixture()
    const { database } = resources()
    const catalog = await addEntry(eventFor(data, { inventoryId: data.catalog.id }))
    const privateEntry = await addEntry(eventFor(data, { inventoryId: data.privateGear.id }))

    expect(catalog.entry).toMatchObject({
      quantity: 1,
      weightGrams: '0',
      weightSource: 'measured'
    })

    expect(privateEntry.entry).toMatchObject({
      weightGrams: '12.00000000000000000001',
      weightSource: 'measured'
    })

    const quantity = await editEntry(eventFor(data, { quantity: 8 }, catalog.entry.id))

    expect(quantity.entry).toMatchObject({
      quantity: 8,
      weightGrams: '0',
      weightSource: 'measured'
    })

    const [secondListRow] = await database.insert(packingLists).values({
      name: 'Another trip',
      userId: data.owner.id
    }).returning()

    const secondList = required(secondListRow)

    await database.insert(packingListEntries).values({
      packingListId: secondList.id,
      userEquipmentId: data.catalog.id
    })

    const separateTrip = await readPackingListDetail(database, secondList.id, data.owner.id)

    expect(separateTrip.entries[0]).toMatchObject({
      quantity: 1,
      weightGrams: '0'
    })

    const catalogCopy = await copyPackingList(database, {
      id: data.list.id,
      userId: data.owner.id,
      name: 'Shared gear copy'
    })

    const copiedDetail = await readPackingListDetail(database, catalogCopy.id, data.owner.id)

    expect(savedGearEntry(copiedDetail, data.catalog.id)).toMatchObject({
      quantity: 8,
      weightSource: 'measured',
      weightGrams: '0',
      isPacked: false
    })

    await expect(editEntry(eventFor(data, {
      quantity: 9,
      weightGrams: null
    }, catalog.entry.id))).rejects.toMatchObject({ statusCode: 400 })

    await expect(editEntry(eventFor(data, { weightGrams: '0' }, privateEntry.entry.id))).rejects.toMatchObject({ statusCode: 400 })

    const retainedQuantity = await readPackingListDetail(database, data.list.id, data.owner.id)

    expect(retainedQuantity.entries.find(entry => entry.id === catalog.entry.id)?.quantity).toBe(8)
    await database.update(userEquipment).set({ measuredWeightGrams: null }).where(eq(userEquipment.userId, data.owner.id))

    const detail = await readPackingListDetail(database, data.list.id, data.owner.id)

    expect(detail.entries.find(entry => entry.id === catalog.entry.id)).toMatchObject({
      weightGrams: '123.456789',
      weightSource: 'catalog'
    })

    expect(detail.entries.find(entry => entry.id === privateEntry.entry.id)).toMatchObject({
      weightGrams: null,
      weightSource: null
    })

    await database.update(itemPropertyValues).set({ valueNumber: '321.00001' }).where(eq(itemPropertyValues.itemId, data.item.id))

    const liveCatalog = await editEntry(eventFor(data, { isPacked: true }, catalog.entry.id))

    expect(liveCatalog.entry).toMatchObject({
      weightGrams: '321.00001',
      weightSource: 'catalog'
    })

    const version = await database.query.packingLists.findFirst({ where: { id: data.list.id } })
    const reset = await clearPacked(eventFor(data, { expectedUpdatedAt: required(version).updatedAt.toISOString() }))

    expect(reset.packingList.entries.find(entry => entry.id === catalog.entry.id)).toMatchObject({
      quantity: 8,
      weightGrams: '321.00001',
      weightSource: 'catalog',
      isPacked: false
    })

    await database.update(categoryProperties).set({ unit: 'kg' }).where(eq(categoryProperties.id, data.property.id))

    const unsupportedUnit = await readPackingListDetail(database, data.list.id, data.owner.id)

    expect(unsupportedUnit.entries.find(entry => entry.id === catalog.entry.id)).toMatchObject({
      weightGrams: null,
      weightSource: null
    })
  })

  it('rejects foreign and missing entries, invalid bodies, and rolls back a failed parent write', async () => {
    const data = await fixture()
    const { database } = resources()

    await expect(editEntry(eventFor({
      ...data,
      owner: data.other
    }, { quantity: 2 }, data.text.id))).rejects.toMatchObject({ statusCode: 404 })

    await expect(editEntry(eventFor(data, { weightGrams: '1' }, data.other.id))).rejects.toMatchObject({ statusCode: 404 })

    await expect(editEntry(eventFor(data, {
      quantity: 2,
      surprise: true
    }))).rejects.toMatchObject({ statusCode: 400 })

    await expect(editEntry(eventFor(data, { quantity: 0 }))).rejects.toMatchObject({ statusCode: 400 })
    await database.execute(sql`CREATE FUNCTION fail_measurement_parent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Simulated parent failure'; END $$`)
    await database.execute(sql`CREATE TRIGGER fail_measurement_parent BEFORE UPDATE ON packing_lists FOR EACH ROW EXECUTE FUNCTION fail_measurement_parent()`)

    const log = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {
      // Expected failure is asserted below.
    })

    try {
      await expect(editEntry(eventFor(data, {
        quantity: 2,
        weightGrams: '0'
      }))).rejects.toMatchObject({ statusCode: 500 })

      expect(log).toHaveBeenCalledWith('Failed to update packing list entry', expect.anything())
      await expect(database.query.packingListEntries.findFirst({ where: { id: data.text.id } })).resolves.toStrictEqual(data.text)
    } finally {
      log.mockRestore()
      await database.execute(sql`DROP TRIGGER fail_measurement_parent ON packing_lists`)
      await database.execute(sql`DROP FUNCTION fail_measurement_parent()`)
    }
  })

  it('enforces quantity and finite non-negative custom weights in PostgreSQL, including saved-gear source restrictions', async () => {
    const data = await fixture()
    const { database } = resources()

    const invalid = [
      sql`UPDATE packing_list_entries SET quantity = 0 WHERE id = ${data.text.id}`,
      sql`UPDATE packing_list_entries SET quantity = 2147483648 WHERE id = ${data.text.id}`,
      sql`UPDATE packing_list_entries SET "customWeightGrams" = '-0.00001' WHERE id = ${data.text.id}`,
      sql`UPDATE packing_list_entries SET "customWeightGrams" = 'NaN' WHERE id = ${data.text.id}`,
      sql`UPDATE packing_list_entries SET "customWeightGrams" = 'Infinity' WHERE id = ${data.text.id}`,
      sql`UPDATE packing_list_entries SET "customWeightGrams" = '-Infinity' WHERE id = ${data.text.id}`,
      sql`INSERT INTO packing_list_entries ("packingListId", "userEquipmentId", "customWeightGrams") VALUES (${data.list.id}, ${data.catalog.id}, 0)`
    ]

    await Promise.all(invalid.map(async statement => { await expect(database.execute(statement)).rejects.toThrow('Failed query') }))
    await expect(database.query.packingListEntries.findFirst({ where: { id: data.text.id } })).resolves.toStrictEqual(data.text)
  })
})
