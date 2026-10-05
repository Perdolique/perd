import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'
import { sql } from 'drizzle-orm'
import { createEvent, updateSession } from 'h3'
import * as v from 'valibot'
import { createTestHarness, type TestHarness } from 'wrangler'
import { fetch as miniflareFetch } from 'miniflare'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  brands,
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

async function accountCookie(userId: string) {
  const socket = new Socket()
  const request = new IncomingMessage(socket)
  const response = new ServerResponse(request)
  const event = createEvent(request, response)

  await updateSession(event, {
    name: 'perdSession',
    password: sessionSecret
  }, {
    userId,
    sessionVersion: 0
  })

  const cookies = response.getHeader('set-cookie')
  const cookie = Array.isArray(cookies) ? cookies[0] : cookies

  if (typeof cookie !== 'string') {
    throw new TypeError('Expected an account session cookie')
  }

  return cookie.split(';')[0] ?? ''
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
  customName: v.string()
})

async function fixture() {
  const { database } = required(isolated)
  const [owner] = await database.insert(users).values({}).returning()
  const [other] = await database.insert(users).values({}).returning()
  const user = required(owner)
  const stranger = required(other)
  const cookie = await accountCookie(user.id)
  const otherCookie = await accountCookie(stranger.id)

  return {
    user,

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

  it('keeps catalog contracts and blocks private gear from packing-list APIs', async () => {
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
    const available = await worker.fetch(`${origin}/api/user/packing-lists/${list.id}/available-gear`, { headers: data.headers })
    const availableJson: unknown = await available.json()

    expect(available.status).toBe(200)

    expect(availableJson).toStrictEqual({
      items: [{
        brand: brand.name,
        category: category.name,
        inventoryId: saved.id,
        itemName: item.name
      }],

      nextPage: null
    })

    const privateEntryBody = JSON.stringify({ inventoryId: custom.id })

    const privateEntry = await worker.fetch(`${origin}/api/user/packing-lists/${list.id}/entries`, {
      method: 'POST',
      headers: data.headers,
      body: privateEntryBody
    })

    expect(privateEntry.status).toBe(404)

    await database.insert(packingListEntries).values({
      packingListId: list.id,
      userEquipmentId: saved.id
    })

    // Direct storage references must keep blocking removal, regardless of source.
    await database.insert(packingListEntries).values({
      packingListId: list.id,
      userEquipmentId: custom.id
    })

    const usedCatalog = await worker.fetch(`${origin}/api/user/gear/${saved.id}`, {
      method: 'DELETE',
      headers: data.headers
    })

    const usedCustom = await worker.fetch(`${origin}/api/user/gear/${custom.id}`, {
      method: 'DELETE',
      headers: data.headers
    })

    expect(usedCatalog.status).toBe(409)
    expect(usedCustom.status).toBe(409)
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
