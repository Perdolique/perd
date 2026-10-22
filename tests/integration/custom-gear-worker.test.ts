import { createAccountCookie } from '../../test-utils/create-account-cookie'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'
import { eq, sql } from 'drizzle-orm'
import * as v from 'valibot'
import { createTestHarness, type TestHarness } from 'wrangler'
import { fetch as miniflareFetch } from 'miniflare'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  brands,
  categoryProperties,
  itemPropertyValues,
  equipmentCategories,
  equipmentItems,
  packingListEntries,
  packingLists,
  userEquipment,
  users
} from '#server/database/schema'

import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

const origin = 'http://localhost:8888'
const sessionSecret = 'custom-gear-worker-integration-session-secret-784'
let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null
let harness: TestHarness | null = null

function inventoryName(entry: v.InferOutput<typeof entrySchema> | undefined) {
  return entry?.source === 'inventory' ? entry.inventory.itemName : null
}

function required<Value>(value: Value | null | undefined): Value {
  if (value === null || value === undefined) {
    throw new Error('Expected initialized test data')
  }

  return value
}

const customRecordSchema = v.strictObject({
  id: v.string(),
  createdAt: v.string(),
  source: v.literal('custom'),
  customName: v.string(),
  note: v.nullable(v.string()),
  measuredWeightGrams: v.nullable(v.string()),
  ownedQuantity: v.number()
})

const catalogRecordSchema = v.strictObject({
  id: v.string(),
  createdAt: v.string(),
  source: v.literal('catalog'),
  personalName: v.nullable(v.string()),
  note: v.nullable(v.string()),
  measuredWeightGrams: v.nullable(v.string()),
  ownedQuantity: v.number(),

  item: v.strictObject({
    id: v.string(),
    name: v.string(),
    weightGrams: v.nullable(v.string()),

    brand: v.strictObject({
      name: v.string(),
      slug: v.string()
    }),

    category: v.strictObject({
      name: v.string(),
      slug: v.string()
    })
  })
})

const inventorySchema = v.variant('source', [
  v.strictObject({
    source: v.literal('catalog'),
    brand: v.string(),
    category: v.string(),
    inventoryId: v.string(),
    itemName: v.string()
  }),
  v.strictObject({
    source: v.literal('custom'),
    inventoryId: v.string(),
    itemName: v.string()
  })
])

const entryFields = {
  id: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
  customName: v.nullable(v.string()),
  isPacked: v.boolean(),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2_147_483_647)),
  weightGrams: v.nullable(v.string()),
  weightSource: v.nullable(v.picklist(['measured', 'catalog', 'custom']))
}

const entrySchema = v.variant('source', [
  v.strictObject({
    ...entryFields,
    source: v.literal('custom')
  }),
  v.strictObject({
    ...entryFields,
    source: v.literal('inventory'),
    inventory: inventorySchema
  })
])

const entryMutationSchema = v.strictObject({
  entry: entrySchema,
  packingListUpdatedAt: v.string()
})

const detailSchema = v.object({
  entries: v.array(entrySchema),
  updatedAt: v.string()
})

const availableSchema = v.strictObject({
  items: v.array(inventorySchema),
  nextPage: v.nullable(v.number())
})

async function readEntry(response: Awaited<ReturnType<TestHarness['fetch']>>) {
  const raw: unknown = await response.json()
  const result = v.parse(entryMutationSchema, raw)

  return result.entry
}

async function readDetail(worker: TestHarness, id: string, headers: Record<string, string>) {
  const path = `${origin}/api/user/packing-lists/${id}`
  const response = await worker.fetch(path, { headers })
  const raw: unknown = await response.json()
  const detail = v.parse(detailSchema, raw)

  expect(response.status).toBe(200)

  return detail
}

async function fixture() {
  const { database } = required(isolated)
  const [owner] = await database.insert(users).values({}).returning()
  const [other] = await database.insert(users).values({}).returning()
  const user = required(owner)
  const stranger = required(other)
  const cookie = await createAccountCookie(user.id, sessionSecret)
  const otherCookie = await createAccountCookie(stranger.id, sessionSecret)

  return {
    user,
    other: stranger,

    headers: {
      cookie,
      origin,
      'content-type': 'application/json'
    },

    otherHeaders: {
      cookie: otherCookie,
      origin,
      'content-type': 'application/json'
    }
  }
}

describe('private custom gear in PostgreSQL and the built Worker', () => {
  beforeAll(async () => {
    const originalFetch = globalThis.fetch

    // Keep real database traffic while bridging Wrangler's outbound WebSocket upgrades.
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new globalThis.Headers(init?.headers)

      if (headers.get('upgrade') === 'websocket') {
        const request = new globalThis.Request(input, init)
        const outboundHeaders = Object.fromEntries(headers)

        return miniflareFetch(request.url, {
          method: request.method,
          headers: outboundHeaders
        })
      }

      return originalFetch(input, init)
    })

    isolated = await createIsolatedPostgreSQL('custom_gear_worker', { httpAccess: true })
    harness = createTestHarness({
      workers: [{
        configPath: './wrangler.jsonc',

        secrets: {
          NUXT_DATABASE_URL: isolated.databaseUrl,
          NUXT_LOCAL_DATABASE: 'true',
          NUXT_SESSION_SECRET: sessionSecret
        }
      }]
    })

    await harness.listen()
  }, 60_000)

  afterAll(async () => {
    const errors: unknown[] = []

    try {
      await harness?.close()
    } catch (error) {
      errors.push(error)
    }

    try {
      await isolated?.dispose()
    } catch (error) {
      errors.push(error)
    } finally {
      vi.unstubAllGlobals()
    }

    if (errors.length === 1) {
      throw errors[0]
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, 'Failed to release custom gear Worker resources')
    }
  })

  it('persists exact private details, partial updates, and ownership checks through the Worker', async () => {
    const data = await fixture()
    const worker = required(harness)
    const gearCollectionPath = `${origin}/api/user/gear`

    const createBody = JSON.stringify({
      customName: '  Personal spoon  ',
      note: '  Without case\nKeep dry  ',
      measuredWeightGrams: '18.123456789123456789',
      ownedQuantity: 2
    })

    const response = await worker.fetch(gearCollectionPath, {
      method: 'POST',
      headers: data.headers,
      body: createBody
    })

    const raw: unknown = await response.json()
    const created = v.parse(customRecordSchema, raw)

    expect(response.status).toBe(201)

    expect(created).toMatchObject({
      customName: 'Personal spoon',
      note: 'Without case\nKeep dry',
      measuredWeightGrams: '18.123456789123456789',
      ownedQuantity: 2
    })

    const gearPath = `${origin}/api/user/gear/${created.id}`
    const forbiddenBody = JSON.stringify({ note: 'Someone else' })

    const forbidden = await worker.fetch(gearPath, {
      method: 'PATCH',
      headers: data.otherHeaders,
      body: forbiddenBody
    })

    expect(forbidden.status).toBe(404)

    const clearNoteBody = JSON.stringify({ note: null })

    const cleared = await worker.fetch(gearPath, {
      method: 'PATCH',
      headers: data.headers,
      body: clearNoteBody
    })

    const clearedRaw: unknown = await cleared.json()

    expect(cleared.status).toBe(200)

    expect(clearedRaw).toStrictEqual({
      ...created,
      note: null
    })

    const invalidBodies = [{ measuredWeightGrams: '-1' }, { ownedQuantity: 0 }, { personalName: 'Catalog-only alias' }]

    const invalidRequestPromises = invalidBodies.map(async body => {
      const serializedBody = JSON.stringify(body)

      return worker.fetch(gearPath, {
        method: 'PATCH',
        headers: data.headers,
        body: serializedBody
      })
    })

    const invalidResponses = await Promise.all(invalidRequestPromises)
    const invalidStatuses = invalidResponses.map(result => result.status)

    expect(invalidStatuses).toStrictEqual([400, 400, 404])

    const { database } = required(isolated)

    const stored = await database.query.userEquipment.findFirst({
      where: {
        id: created.id
      }
    })

    expect(stored).toMatchObject({
      customName: 'Personal spoon',
      note: null,
      measuredWeightGrams: '18.123456789123456789',
      ownedQuantity: 2
    })
  })

  it('reads live catalog weight and personal names across lists without changing catalog or other owners', async () => {
    const data = await fixture()
    const worker = required(harness)
    const { database } = required(isolated)
    const gearCollectionPath = `${origin}/api/user/gear`

    const [brandRow] = await database.insert(brands).values({
      name: 'Personal brand',
      slug: data.user.id
    }).returning()

    const [categoryRow] = await database.insert(equipmentCategories).values({
      name: 'Personal category',
      slug: data.user.id
    }).returning()

    const brand = required(brandRow)
    const category = required(categoryRow)

    const [itemRow] = await database.insert(equipmentItems).values({
      name: 'Catalog stove',
      brandId: brand.id,
      categoryId: category.id,
      status: 'approved'
    }).returning()

    const item = required(itemRow)

    const otherProperties = [0, 1, 2].map(displayOrder => {
      const name = `Other ${displayOrder}`
      const slug = `other-${displayOrder}`

      return {
        categoryId: category.id,
        displayOrder,
        name,
        slug,
        dataType: 'number' as const
      }
    })

    await database.insert(categoryProperties).values(otherProperties)

    const [propertyRow] = await database.insert(categoryProperties).values({
      categoryId: category.id,
      displayOrder: 3,
      name: 'Weight',
      slug: 'weight',
      dataType: 'number',
      unit: 'g'
    }).returning()

    const property = required(propertyRow)

    const [valueRow] = await database.insert(itemPropertyValues).values({
      itemId: item.id,
      propertyId: property.id,
      valueNumber: '20.123456789123456789'
    }).returning()

    const value = required(valueRow)
    const saveBody = JSON.stringify({ itemId: item.id })

    const savedResponse = await worker.fetch(gearCollectionPath, {
      method: 'POST',
      headers: data.headers,
      body: saveBody
    })

    const savedRaw: unknown = await savedResponse.json()
    const saved = v.parse(catalogRecordSchema, savedRaw)
    const gearPath = `${gearCollectionPath}/${saved.id}`

    expect(savedResponse.status).toBe(201)
    expect(saved.item.weightGrams).toBe('20.123456789123456789')

    expect(saved).toMatchObject({
      personalName: null,
      measuredWeightGrams: null,
      note: null,
      ownedQuantity: 1
    })

    const otherSaved = await worker.fetch(gearCollectionPath, {
      method: 'POST',
      headers: data.otherHeaders,
      body: saveBody
    })

    expect(otherSaved.status).toBe(201)

    const lists = await database.insert(packingLists).values([
      {
        userId: data.user.id,
        name: 'First personal trip'
      },
      {
        userId: data.user.id,
        name: 'Second personal trip'
      },
      {
        userId: data.user.id,
        name: 'Picker trip'
      }
    ]).returning()

    const first = required(lists[0])
    const second = required(lists[1])
    const picker = required(lists[2])

    const beforeEntries = await database.insert(packingListEntries).values([
      {
        packingListId: first.id,
        userEquipmentId: saved.id,
        isPacked: true
      },
      {
        packingListId: second.id,
        userEquipmentId: saved.id,
        isPacked: false
      }
    ]).returning()

    const personalDetailsBody = JSON.stringify({
      personalName: 'My green stove',
      note: 'No case',
      measuredWeightGrams: '0',
      ownedQuantity: 2
    })

    const changed = await worker.fetch(gearPath, {
      method: 'PATCH',
      headers: data.headers,
      body: personalDetailsBody
    })

    const changedRaw: unknown = await changed.json()
    const personal = v.parse(catalogRecordSchema, changedRaw)

    expect(changed.status).toBe(200)

    expect(personal).toMatchObject({
      personalName: 'My green stove',
      measuredWeightGrams: '0',
      ownedQuantity: 2
    })

    expect(personal.item).toStrictEqual(saved.item)

    const detailPromises = [first, second].map(async list => readDetail(worker, list.id, data.headers))
    const details = await Promise.all(detailPromises)
    const detailNames = details.map(detail => inventoryName(detail.entries[0]))
    const packedStates = details.map(detail => detail.entries[0]?.isPacked)

    expect(detailNames).toStrictEqual(['My green stove', 'My green stove'])
    expect(packedStates).toStrictEqual([true, false])

    expect(details.map(detail => detail.entries[0])).toMatchObject([
      {
        quantity: 1,
        weightGrams: '0',
        weightSource: 'measured'
      },
      {
        quantity: 1,
        weightGrams: '0',
        weightSource: 'measured'
      }
    ])

    const afterEntries = await database.query.packingListEntries.findMany({
      where: {
        userEquipmentId: saved.id
      },

      orderBy: {
        id: 'asc'
      }
    })

    expect(afterEntries).toStrictEqual(beforeEntries)

    const afterLists = await database.query.packingLists.findMany({
      where: {
        userId: data.user.id
      },

      orderBy: {
        id: 'asc'
      }
    })

    expect(afterLists).toStrictEqual(lists)

    const searchPromises = ['My green stove', 'Catalog stove'].map(async search => {
      const encodedSearch = encodeURIComponent(search)
      const searchPath = `${origin}/api/user/packing-lists/${picker.id}/available-gear?search=${encodedSearch}`

      return worker.fetch(searchPath, { headers: data.headers })
    })

    const searches = await Promise.all(searchPromises)

    const searchBodyPromises = searches.map(async response => {
      const json: unknown = await response.json()

      return v.parse(availableSchema, json)
    })

    const searchBodies = await Promise.all(searchBodyPromises)
    const searchNames = searchBodies.map(body => body.items[0]?.itemName)

    expect(searchNames).toStrictEqual(['My green stove', 'My green stove'])

    const otherRead = await worker.fetch(gearCollectionPath, { headers: data.otherHeaders })
    const otherRaw: unknown = await otherRead.json()
    const [otherRecord] = v.parse(v.array(catalogRecordSchema), otherRaw)

    expect(otherRecord).toMatchObject({
      personalName: null,
      measuredWeightGrams: null,
      note: null,
      ownedQuantity: 1
    })

    const unchangedItem = await database.query.equipmentItems.findFirst({
      where: {
        id: item.id
      }
    })

    expect(unchangedItem).toStrictEqual(item)

    const clearPersonalDetailsBody = JSON.stringify({
      personalName: '',
      measuredWeightGrams: null
    })

    const cleared = await worker.fetch(gearPath, {
      method: 'PATCH',
      headers: data.headers,
      body: clearPersonalDetailsBody
    })

    const clearedRaw: unknown = await cleared.json()
    const clearedRecord = v.parse(catalogRecordSchema, clearedRaw)

    expect(clearedRecord).toMatchObject({
      personalName: null,
      measuredWeightGrams: null,
      note: 'No case',
      ownedQuantity: 2
    })

    await database.update(itemPropertyValues).set({ valueNumber: '22.7654321987654321' }).where(
      eq(itemPropertyValues.id, value.id)
    )

    const liveResponse = await worker.fetch(gearCollectionPath, { headers: data.headers })
    const liveRaw: unknown = await liveResponse.json()
    const [liveRecord] = v.parse(v.array(catalogRecordSchema), liveRaw)

    expect(liveRecord?.item.weightGrams).toBe('22.7654321987654321')

    const detail = await readDetail(worker, first.id, data.headers)
    const fallbackName = inventoryName(detail.entries[0])

    expect(fallbackName).toBe('Catalog stove')

    await database.update(categoryProperties).set({ unit: 'kg' }).where(
      eq(categoryProperties.id, property.id)
    )

    const unsupportedResponse = await worker.fetch(gearCollectionPath, { headers: data.headers })
    const unsupportedRaw: unknown = await unsupportedResponse.json()
    const [unsupportedRecord] = v.parse(v.array(catalogRecordSchema), unsupportedRaw)

    expect(unsupportedRecord?.item.weightGrams).toBeNull()
  })

  it('enforces finite nonnegative measurements, positive quantities, and catalog-only aliases in PostgreSQL', async () => {
    const data = await fixture()
    const { database } = required(isolated)

    const invalidValues = [
      {
        customName: 'Negative',
        measuredWeightGrams: '-0.1'
      },
      {
        customName: 'NaN',
        measuredWeightGrams: 'NaN'
      },
      {
        customName: 'Infinity',
        measuredWeightGrams: 'Infinity'
      },
      {
        customName: 'Missing quantity',
        ownedQuantity: 0
      },
      {
        customName: 'Private alias',
        personalName: 'Not allowed'
      }
    ]

    const invalidInsertPromises = invalidValues.map(async values => {
      const insert = database.insert(userEquipment).values({
        ...values,
        userId: data.user.id
      })

      await expect(insert).rejects.toMatchObject({ cause: { code: '23514' } })
    })

    await Promise.all(invalidInsertPromises)
  })

  it('persists guest-owned custom gear, permits duplicate names, and isolates owners', async () => {
    const data = await fixture()
    const worker = required(harness)
    const body = JSON.stringify({ customName: '  My DIY Stove  ' })

    const createdResponse = await worker.fetch(`${origin}/api/user/gear`, {
      method: 'POST',
      headers: data.headers,
      body
    })

    const createdJson: unknown = await createdResponse.json()
    const created = v.parse(customRecordSchema, createdJson)

    expect(createdResponse.status).toBe(201)
    expect(created.customName).toBe('My DIY Stove')

    const duplicateResponse = await worker.fetch(`${origin}/api/user/gear`, {
      method: 'POST',
      headers: data.headers,
      body
    })

    const duplicateJson: unknown = await duplicateResponse.json()
    const duplicate = v.parse(customRecordSchema, duplicateJson)

    expect(duplicateResponse.status).toBe(201)
    expect(duplicate.id).not.toBe(created.id)

    const read = await worker.fetch(`${origin}/api/user/gear`, { headers: data.headers })
    const readJson: unknown = await read.json()

    expect(read.status).toBe(200)
    expect(readJson).toStrictEqual([duplicate, created])

    const otherRead = await worker.fetch(`${origin}/api/user/gear`, { headers: data.otherHeaders })
    const otherJson: unknown = await otherRead.json()

    expect(otherJson).toStrictEqual([])

    const path = `${origin}/api/user/gear/${created.id}`
    const renamedBody = JSON.stringify({ customName: '  Renamed Stove  ' })

    const forbiddenRename = await worker.fetch(path, {
      method: 'PATCH',
      headers: data.otherHeaders,
      body: renamedBody
    })

    const forbiddenDelete = await worker.fetch(path, {
      method: 'DELETE',
      headers: data.otherHeaders
    })

    expect(forbiddenRename.status).toBe(404)
    expect(forbiddenDelete.status).toBe(404)

    const renamedResponse = await worker.fetch(path, {
      method: 'PATCH',
      headers: data.headers,
      body: renamedBody
    })

    const renamedJson: unknown = await renamedResponse.json()
    const renamed = v.parse(customRecordSchema, renamedJson)

    expect(renamedResponse.status).toBe(200)

    expect(renamed).toStrictEqual({
      ...created,
      customName: 'Renamed Stove'
    })

    const reloaded = await worker.fetch(`${origin}/api/user/gear`, { headers: data.headers })
    const reloadedJson: unknown = await reloaded.json()

    expect(reloadedJson).toStrictEqual([duplicate, renamed])

    const { database } = required(isolated)
    const catalog = await database.query.equipmentItems.findMany({ where: { createdBy: data.user.id } })

    expect(catalog).toStrictEqual([])

    const removed = await worker.fetch(path, {
      method: 'DELETE',
      headers: data.headers
    })

    const missing = await worker.fetch(path, {
      method: 'PATCH',
      headers: data.headers,
      body: renamedBody
    })

    const afterRemove = await worker.fetch(`${origin}/api/user/gear`, { headers: data.headers })
    const afterRemoveJson: unknown = await afterRemove.json()

    expect(removed.status).toBe(204)
    expect(missing.status).toBe(404)
    expect(afterRemoveJson).toStrictEqual([duplicate])
  })

  it('reuses private gear across lists with live names, independent packed state, and protected removal', async () => {
    const data = await fixture()
    const worker = required(harness)
    const { database } = required(isolated)

    const [brandRow] = await database.insert(brands).values({
      name: 'Brand',
      slug: data.user.id
    }).returning()

    const [categoryRow] = await database.insert(equipmentCategories).values({
      name: 'Category',
      slug: data.user.id
    }).returning()

    const brand = required(brandRow)
    const category = required(categoryRow)

    const [itemRow] = await database.insert(equipmentItems).values({
      name: 'Catalog stove',
      brandId: brand.id,
      categoryId: category.id
    }).returning()

    const item = required(itemRow)

    const [listRow] = await database.insert(packingLists).values({
      userId: data.user.id,
      name: 'Trip'
    }).returning()

    const list = required(listRow)
    const catalogBody = JSON.stringify({ itemId: item.id })

    const catalogResponse = await worker.fetch(`${origin}/api/user/gear`, {
      method: 'POST',
      headers: data.headers,
      body: catalogBody
    })

    const catalogJson: unknown = await catalogResponse.json()

    const saved = v.parse(v.object({
      id: v.string(),
      source: v.literal('catalog')
    }), catalogJson)

    expect(catalogResponse.status).toBe(201)

    expect(catalogJson).toMatchObject({ item: {
      id: item.id,
      name: item.name
    } })

    const duplicate = await worker.fetch(`${origin}/api/user/gear`, {
      method: 'POST',
      headers: data.headers,
      body: catalogBody
    })

    const renameBody = JSON.stringify({ customName: 'Forbidden' })

    const catalogRename = await worker.fetch(`${origin}/api/user/gear/${saved.id}`, {
      method: 'PATCH',
      headers: data.headers,
      body: renameBody
    })

    expect(duplicate.status).toBe(409)
    expect(catalogRename.status).toBe(404)

    const customResponse = await worker.fetch(`${origin}/api/user/gear`, {
      method: 'POST',
      headers: data.headers,
      body: renameBody
    })

    const customJson: unknown = await customResponse.json()
    const custom = v.parse(customRecordSchema, customJson)
    const listPath = `${origin}/api/user/packing-lists/${list.id}`
    const availablePath = `${listPath}/available-gear`
    const entriesPath = `${listPath}/entries`
    const available = await worker.fetch(availablePath, { headers: data.headers })
    const availableJson: unknown = await available.json()

    expect(available.status).toBe(200)

    expect(availableJson).toStrictEqual({
      items: [{
        source: 'catalog',
        brand: brand.name,
        category: category.name,
        inventoryId: saved.id,
        itemName: item.name
      }, {
        source: 'custom',
        inventoryId: custom.id,
        itemName: 'Forbidden'
      }],

      nextPage: null
    })

    const privateEntryBody = JSON.stringify({ inventoryId: custom.id })

    const privateEntry = await worker.fetch(entriesPath, {
      method: 'POST',
      headers: data.headers,
      body: privateEntryBody
    })

    expect(privateEntry.status).toBe(201)

    const firstEntry = await readEntry(privateEntry)

    expect(firstEntry).toMatchObject({
      quantity: 1,
      weightGrams: null,
      weightSource: null,
      customName: null,
      isPacked: false,
      source: 'inventory',

      inventory: {
        source: 'custom',
        inventoryId: custom.id,
        itemName: 'Forbidden'
      }
    })

    const duplicateEntry = await worker.fetch(entriesPath, {
      method: 'POST',
      headers: data.headers,
      body: privateEntryBody
    })

    expect(duplicateEntry.status).toBe(409)

    const [secondListRow] = await database.insert(packingLists).values({
      userId: data.user.id,
      name: 'Second trip'
    }).returning()

    const [otherListRow] = await database.insert(packingLists).values({
      userId: data.other.id,
      name: 'Other trip'
    }).returning()

    const secondList = required(secondListRow)
    const otherList = required(otherListRow)
    const secondEntriesPath = `${origin}/api/user/packing-lists/${secondList.id}/entries`
    const otherEntriesPath = `${origin}/api/user/packing-lists/${otherList.id}/entries`
    const otherAvailablePath = `${origin}/api/user/packing-lists/${otherList.id}/available-gear`

    const secondResponse = await worker.fetch(secondEntriesPath, {
      method: 'POST',
      headers: data.headers,
      body: privateEntryBody
    })

    expect(secondResponse.status).toBe(201)

    const secondEntry = await readEntry(secondResponse)

    expect(secondEntry.id).not.toBe(firstEntry.id)

    const foreignEntry = await worker.fetch(otherEntriesPath, {
      method: 'POST',
      headers: data.otherHeaders,
      body: privateEntryBody
    })

    expect(foreignEntry.status).toBe(404)

    const otherAvailable = await worker.fetch(otherAvailablePath, { headers: data.otherHeaders })
    const otherAvailableJson: unknown = await otherAvailable.json()

    expect(otherAvailableJson).toStrictEqual({
      items: [],
      nextPage: null
    })

    const usedAvailable = await worker.fetch(availablePath, { headers: data.headers })
    const usedAvailableJson: unknown = await usedAvailable.json()
    const usedAvailableBody = v.parse(availableSchema, usedAvailableJson)
    const usedAvailableIds = usedAvailableBody.items.map(row => row.inventoryId)

    expect(usedAvailableIds).toStrictEqual([saved.id])

    const firstPath = `${entriesPath}/${firstEntry.id}`
    const packedBody = JSON.stringify({ isPacked: true })

    const packedResponse = await worker.fetch(firstPath, {
      method: 'PATCH',
      headers: data.headers,
      body: packedBody
    })

    expect(packedResponse.status).toBe(200)

    const packedEntry = await readEntry(packedResponse)

    expect(packedEntry.isPacked).toBe(true)

    expect(packedEntry).toMatchObject({ inventory: {
      source: 'custom',
      inventoryId: custom.id
    } })

    const gearPath = `${origin}/api/user/gear/${custom.id}`
    const updatedNameBody = JSON.stringify({ customName: 'Updated private stove' })

    const renamed = await worker.fetch(gearPath, {
      method: 'PATCH',
      headers: data.headers,
      body: updatedNameBody
    })

    expect(renamed.status).toBe(200)

    const firstDetail = await readDetail(worker, list.id, data.headers)
    const secondDetail = await readDetail(worker, secondList.id, data.headers)

    expect(firstDetail.entries).toMatchObject([{
      isPacked: true,
      inventory: { itemName: 'Updated private stove' }
    }])

    expect(secondDetail.entries).toMatchObject([{
      isPacked: false,
      inventory: { itemName: 'Updated private stove' }
    }])

    const unpackedBody = JSON.stringify({ isPacked: false })

    const foreignPatch = await worker.fetch(firstPath, {
      method: 'PATCH',
      headers: data.otherHeaders,
      body: unpackedBody
    })

    const foreignDelete = await worker.fetch(firstPath, {
      method: 'DELETE',
      headers: data.otherHeaders
    })

    expect(foreignPatch.status).toBe(404)
    expect(foreignDelete.status).toBe(404)

    const usedCustom = await worker.fetch(gearPath, {
      method: 'DELETE',
      headers: data.headers
    })

    expect(usedCustom.status).toBe(409)

    const removedFirst = await worker.fetch(firstPath, {
      method: 'DELETE',
      headers: data.headers
    })

    const stillUsed = await worker.fetch(gearPath, {
      method: 'DELETE',
      headers: data.headers
    })

    const secondAfterRemove = await readDetail(worker, secondList.id, data.headers)

    expect(removedFirst.status).toBe(200)
    expect(stillUsed.status).toBe(409)

    expect(secondAfterRemove.entries).toMatchObject([{
      id: secondEntry.id,
      isPacked: false
    }])

    const secondEntryPath = `${secondEntriesPath}/${secondEntry.id}`

    const removedSecond = await worker.fetch(secondEntryPath, {
      method: 'DELETE',
      headers: data.headers
    })

    const removedGear = await worker.fetch(gearPath, {
      method: 'DELETE',
      headers: data.headers
    })

    expect(removedSecond.status).toBe(200)
    expect(removedGear.status).toBe(204)

    await database.insert(packingListEntries).values({
      packingListId: list.id,
      userEquipmentId: saved.id
    })

    const catalogGearPath = `${origin}/api/user/gear/${saved.id}`

    const usedCatalog = await worker.fetch(catalogGearPath, {
      method: 'DELETE',
      headers: data.headers
    })

    expect(usedCatalog.status).toBe(409)
  })

  it('searches and paginates mixed saved sources without leaking owners or interpreting wildcards', async () => {
    const data = await fixture()
    const worker = required(harness)
    const { database } = required(isolated)

    const [listRow] = await database.insert(packingLists).values({
      userId: data.user.id,
      name: 'Search trip'
    }).returning()

    const list = required(listRow)

    const [brandRow] = await database.insert(brands).values({
      name: 'Search brand',
      slug: data.user.id
    }).returning()

    const [categoryRow] = await database.insert(equipmentCategories).values({
      name: 'Search category',
      slug: data.user.id
    }).returning()

    const brand = required(brandRow)
    const category = required(categoryRow)

    const [itemRow] = await database.insert(equipmentItems).values({
      name: 'Alpha gear',
      brandId: brand.id,
      categoryId: category.id
    }).returning()

    const item = required(itemRow)

    const [catalogRow] = await database.insert(userEquipment).values({
      userId: data.user.id,
      itemId: item.id
    }).returning()

    const catalog = required(catalogRow)

    const privateValues = Array.from({ length: 11 }, () => {
      return {
        userId: data.user.id,
        customName: 'Same private gear'
      }
    })

    const privateRows = await database.insert(userEquipment).values(privateValues).returning()

    const [literalRow] = await database.insert(userEquipment).values({
      userId: data.user.id,
      customName: String.raw`100%_\ gear`
    }).returning()

    const literal = required(literalRow)

    await database.insert(userEquipment).values({
      userId: data.other.id,
      customName: 'Same private gear'
    })

    const path = `${origin}/api/user/packing-lists/${list.id}/available-gear`
    const firstResponse = await worker.fetch(path, { headers: data.headers })
    const firstRaw: unknown = await firstResponse.json()
    const first = v.parse(availableSchema, firstRaw)
    const secondPagePath = `${path}?page=2`
    const secondResponse = await worker.fetch(secondPagePath, { headers: data.headers })
    const secondRaw: unknown = await secondResponse.json()
    const second = v.parse(availableSchema, secondRaw)
    const all = [...first.items, ...second.items]
    const privateIds = privateRows.map(row => row.id)
    const expectedPrivateIds = privateIds.toSorted()
    const allIds = all.map(row => row.inventoryId)

    expect(first.items).toHaveLength(10)
    expect(first.nextPage).toBe(2)
    expect(second.nextPage).toBeNull()
    expect(allIds).toStrictEqual([literal.id, catalog.id, ...expectedPrivateIds])

    const searchPath = `${path}?search=sAmE%20pRiVaTe`
    const searched = await worker.fetch(searchPath, { headers: data.headers })
    const searchRaw: unknown = await searched.json()
    const search = v.parse(availableSchema, searchRaw)
    const searchIds = search.items.map(row => row.inventoryId)
    const expectedSearchIds = expectedPrivateIds.slice(0, 10)

    expect(searchIds).toStrictEqual(expectedSearchIds)

    const escaped = encodeURIComponent('%_\\')
    const literalPath = `${path}?search=${escaped}`
    const literalResponse = await worker.fetch(literalPath, { headers: data.headers })
    const literalRaw: unknown = await literalResponse.json()
    const literalResult = v.parse(availableSchema, literalRaw)
    const literalIds = literalResult.items.map(row => row.inventoryId)

    expect(literalIds).toStrictEqual([literal.id])

    for (const term of ['Search brand', 'Search category']) {
      const encodedSearch = encodeURIComponent(term)
      const catalogSearchPath = `${path}?search=${encodedSearch}`

      // oxlint-disable-next-line no-await-in-loop -- Each search owns an independent response assertion.
      const response = await worker.fetch(catalogSearchPath, { headers: data.headers })

      // oxlint-disable-next-line no-await-in-loop -- Parse the response before checking its catalog match.
      const raw: unknown = await response.json()
      const result = v.parse(availableSchema, raw)
      const matchingIds = result.items.map(row => row.inventoryId)

      expect(matchingIds).toStrictEqual([catalog.id])
    }
  })

  it('ranks a private name prefix before a catalog brand prefix', async () => {
    const data = await fixture()
    const worker = required(harness)
    const { database } = required(isolated)

    const [listRow] = await database.insert(packingLists).values({
      userId: data.user.id,
      name: 'Relevance trip'
    }).returning()

    const [brandRow] = await database.insert(brands).values({
      name: 'Stove brand',
      slug: data.user.id
    }).returning()

    const [categoryRow] = await database.insert(equipmentCategories).values({
      name: 'Cooking',
      slug: data.user.id
    }).returning()

    const list = required(listRow)
    const brand = required(brandRow)
    const category = required(categoryRow)

    const [itemRow] = await database.insert(equipmentItems).values({
      name: 'Alpha',
      brandId: brand.id,
      categoryId: category.id
    }).returning()

    const item = required(itemRow)

    const [catalogRow, privateRow] = await database.insert(userEquipment).values([{
      userId: data.user.id,
      itemId: item.id
    }, {
      userId: data.user.id,
      customName: 'Stove DIY'
    }]).returning()

    const catalog = required(catalogRow)
    const privateGear = required(privateRow)
    const path = `${origin}/api/user/packing-lists/${list.id}/available-gear?search=Stove`
    const response = await worker.fetch(path, { headers: data.headers })
    const raw: unknown = await response.json()
    const result = v.parse(availableSchema, raw)
    const matchingIds = result.items.map(row => row.inventoryId)

    expect(response.status).toBe(200)
    expect(matchingIds).toStrictEqual([privateGear.id, catalog.id])
    expect(result.nextPage).toBeNull()
  })

  it('keeps add/delete races atomic for private saved gear', async () => {
    const data = await fixture()
    const worker = required(harness)
    const { database } = required(isolated)
    const initialUpdatedAt = new Date('2020-01-01T00:00:00Z')

    const [listRow] = await database.insert(packingLists).values({
      userId: data.user.id,
      name: 'Race trip',
      updatedAt: initialUpdatedAt
    }).returning()

    const [gearRow] = await database.insert(userEquipment).values({
      userId: data.user.id,
      customName: 'Race gear'
    }).returning()

    const list = required(listRow)
    const gear = required(gearRow)
    const entriesPath = `${origin}/api/user/packing-lists/${list.id}/entries`
    const gearPath = `${origin}/api/user/gear/${gear.id}`
    const createBody = JSON.stringify({ inventoryId: gear.id })

    const addPromise = worker.fetch(entriesPath, {
      method: 'POST',
      headers: data.headers,
      body: createBody
    })

    const deletePromise = worker.fetch(gearPath, {
      method: 'DELETE',
      headers: data.headers
    })

    const [added, deleted] = await Promise.all([addPromise, deletePromise])
    const remainingGear = await database.query.userEquipment.findFirst({ where: { id: gear.id } })
    const entries = await database.query.packingListEntries.findMany({ where: { packingListId: list.id } })

    expect([[201, 409], [404, 204]]).toContainEqual([added.status, deleted.status])

    const expectedEntryCount = Number(added.status === 201)

    expect(entries).toHaveLength(expectedEntryCount)
    expect(remainingGear !== undefined).toBe(added.status === 201)

    const unchanged = await database.query.packingLists.findFirst({ where: { id: list.id } })
    const actual = required(unchanged)
    const actualTimestamp = actual.updatedAt.getTime()
    const initialTimestamp = list.updatedAt.getTime()
    const isListTouched = actualTimestamp > initialTimestamp

    expect(isListTouched).toBe(added.status === 201)

  })

  it('rejects source-less and mixed-source rows in PostgreSQL', async () => {
    const data = await fixture()
    const { database } = required(isolated)
    const noSource = database.insert(userEquipment).values({ userId: data.user.id })

    await expect(noSource).rejects.toMatchObject({ cause: { code: '23514' } })

    const bothSources = database.insert(userEquipment).values({
      userId: data.user.id,
      itemId: data.user.id,
      customName: 'Both'
    })

    await expect(bothSources).rejects.toMatchObject({ cause: { code: '23514' } })
  })
})

describe('custom gear migration', () => {
it('preserves old saved gear, uniqueness, and packing-list references through migration', async () => {
  const migrationName = '20261004182433_private-custom-gear'
  const previous = await createIsolatedPostgreSQL('custom_gear_migration', { beforeMigration: migrationName })

  try {
    const { database } = previous

    const oldRows = await database.execute(sql`
      WITH owner AS (INSERT INTO users DEFAULT VALUES RETURNING id),
      brand AS (INSERT INTO brands (name, slug) VALUES ('Brand', 'brand') RETURNING id),
      category AS (INSERT INTO equipment_categories (name, slug) VALUES ('Category', 'category') RETURNING id),
      item AS (INSERT INTO equipment_items (name, "brandId", "categoryId") SELECT 'Stove', brand.id, category.id FROM brand, category RETURNING id),
      gear AS (INSERT INTO user_equipment ("userId", "itemId") SELECT owner.id, item.id FROM owner, item RETURNING *),
      list AS (INSERT INTO packing_lists ("userId", name) SELECT owner.id, 'Trip' FROM owner RETURNING id),
      entry AS (INSERT INTO packing_list_entries ("packingListId", "userEquipmentId") SELECT list.id, gear.id FROM list, gear RETURNING id)
      SELECT gear.*, entry.id AS "entryId" FROM gear, entry
    `)

    const before = required(oldRows.rows[0])
    const migrationPath = new URL(`../../server/database/migrations/${migrationName}/migration.sql`, import.meta.url)
    const migration = await readFile(migrationPath, 'utf8')

    await database.execute(sql.raw(migration))

    const afterRows = await database.execute(sql`
      SELECT gear.*, entry.id AS "entryId" FROM user_equipment gear
      JOIN packing_list_entries entry ON entry."userEquipmentId" = gear.id
    `)

    expect(afterRows.rows).toStrictEqual([{
      ...before,
      customName: null
    }])

    await expect(database.execute(sql`
      INSERT INTO user_equipment ("userId", "itemId") SELECT "userId", "itemId" FROM user_equipment
    `)).rejects.toMatchObject({ cause: { code: '23505' } })
  } finally {
    await previous.dispose()
  }
})

})

describe('personal gear details migration', () => {
  it('preserves both saved sources, IDs, owners, dates, and packing references with safe defaults', async () => {
    const migrationName = '20261016183228_personal-gear-details'
    const previous = await createIsolatedPostgreSQL('personal_gear_migration', { beforeMigration: migrationName })

    try {
      const { database } = previous

      const beforeRows = await database.execute(sql`
        WITH owner AS (INSERT INTO users DEFAULT VALUES RETURNING id),
        brand AS (INSERT INTO brands (name, slug) VALUES ('Brand', 'brand') RETURNING id),
        category AS (INSERT INTO equipment_categories (name, slug) VALUES ('Category', 'category') RETURNING id),
        item AS (INSERT INTO equipment_items (name, "brandId", "categoryId") SELECT 'Stove', brand.id, category.id FROM brand, category RETURNING id),
        catalog_gear AS (INSERT INTO user_equipment ("userId", "itemId") SELECT owner.id, item.id FROM owner, item RETURNING *),
        custom_gear AS (INSERT INTO user_equipment ("userId", "customName") SELECT owner.id, 'DIY stove' FROM owner RETURNING *),
        gear AS (SELECT * FROM catalog_gear UNION ALL SELECT * FROM custom_gear),
        list AS (INSERT INTO packing_lists ("userId", name) SELECT owner.id, 'Trip' FROM owner RETURNING id),
        entry AS (INSERT INTO packing_list_entries ("packingListId", "userEquipmentId") SELECT list.id, gear.id FROM list, gear RETURNING id, "userEquipmentId")
        SELECT gear.*, entry.id AS "entryId" FROM gear JOIN entry ON entry."userEquipmentId" = gear.id ORDER BY gear.id
      `)

      const migrationPath = new URL(`../../server/database/migrations/${migrationName}/migration.sql`, import.meta.url)
      const migration = await readFile(migrationPath, 'utf8')

      await database.execute(sql.raw(migration))

      const afterRows = await database.execute(sql`
        SELECT gear.*, entry.id AS "entryId" FROM user_equipment gear
        JOIN packing_list_entries entry ON entry."userEquipmentId" = gear.id ORDER BY gear.id
      `)

      const expected = []

      for (const row of beforeRows.rows) {
        expected.push({
          ...row,
          personalName: null,
          note: null,
          measuredWeightGrams: null,
          ownedQuantity: 1
        })
      }

      expect(beforeRows.rows).toHaveLength(2)
      expect(afterRows.rows).toStrictEqual(expected)

      await expect(database.execute(sql`
        INSERT INTO user_equipment ("userId", "itemId") SELECT "userId", "itemId" FROM user_equipment WHERE "itemId" IS NOT NULL
      `)).rejects.toMatchObject({ cause: { code: '23505' } })
    } finally {
      await previous.dispose()
    }
  })
})
