import { createAccountCookie } from '../../test-utils/create-account-cookie'
import * as v from 'valibot'
import { createTestHarness, type TestHarness } from 'wrangler'
import { fetch as miniflareFetch } from 'miniflare'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  brands,
  categoryProperties,
  equipmentCategories,
  equipmentItems,
  itemPropertyValues,
  users
} from '#server/database/schema'

import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

const origin = 'http://localhost:8888'
const sessionSecret = 'item-editor-worker-integration-session-secret-783'
let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null
let harness: TestHarness | null = null

function required<Value>(value: Value | null | undefined): Value {
  if (value === null || value === undefined) {
    throw new Error('Expected initialized test data')
  }

  return value
}

const editSnapshotSchema = v.object({
  id: v.string(),
  name: v.string(),
  revision: v.number(),

  category: v.object({
    id: v.number(),
    propertiesRevision: v.number()
  }),

  properties: v.array(v.object({
    propertyId: v.number(),
    value: v.union([v.string(), v.boolean()])
  }))
})

async function fixture(isAdmin = true) {
  const { database } = required(isolated)
  const [userRow] = await database.insert(users).values({ isAdmin }).returning()
  const user = required(userRow)

  const [brandRow] = await database.insert(brands).values({
    name: `Brand ${user.id}`,
    slug: user.id
  }).returning()

  const brand = required(brandRow)

  const [categoryRow] = await database.insert(equipmentCategories).values({
    name: 'Category',
    slug: user.id
  }).returning()

  const category = required(categoryRow)

  const [propertyRow] = await database.insert(categoryProperties).values({
    categoryId: category.id,
    name: 'Weight',
    slug: 'weight',
    dataType: 'number',
    unit: 'g',
    displayOrder: 0
  }).returning()

  const property = required(propertyRow)

  const [itemRow] = await database.insert(equipmentItems).values({
    name: 'Original',
    categoryId: category.id,
    brandId: brand.id
  }).returning()

  const item = required(itemRow)

  await database.insert(itemPropertyValues).values({
    itemId: item.id,
    propertyId: property.id,
    valueNumber: '9007199254740993.125'
  })

  const cookie = await createAccountCookie(user.id, sessionSecret)
  const path = `${origin}/api/equipment/items/${item.id}`

  const body = {
    name: 'Corrected',
    brandId: brand.id,
    categoryId: category.id,

    properties: [{
      propertyId: property.id,
      value: '0'
    }],

    expectedItemRevision: 0,
    expectedOriginalPropertiesRevision: 0,
    expectedPropertiesRevision: 0
  }

  return {
    path,
    body,
    cookie,
    item,
    property
  }
}

describe('published item editing in the built Nuxt Worker', () => {
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

    isolated = await createIsolatedPostgreSQL('item_edits_worker', { httpAccess: true })
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
      throw new AggregateError(errors, 'Failed to release item editor Worker resources')
    }
  })

  it('serves exact editor values, persists corrections, and rejects a stale retry', async () => {
    const data = await fixture()
    const worker = required(harness)

    const headers = {
      cookie: data.cookie,
      origin,
      'content-type': 'application/json'
    }

    const read = await worker.fetch(`${data.path}/edit`, { headers })
    const readJson: unknown = await read.json()
    const snapshot = v.parse(editSnapshotSchema, readJson)

    expect(read.status).toBe(200)

    expect(snapshot.properties).toStrictEqual([{
      propertyId: data.property.id,
      value: '9007199254740993.125'
    }])

    const updateBody = JSON.stringify(data.body)

    const update = await worker.fetch(data.path, {
      method: 'PATCH',
      headers,
      body: updateBody
    })

    const updatedJson: unknown = await update.json()
    const updated = v.parse(editSnapshotSchema, updatedJson)

    expect(update.status).toBe(200)

    expect(updated).toMatchObject({
      name: 'Corrected',
      revision: 1,

      properties: [{
        propertyId: data.property.id,
        value: '0'
      }]
    })

    const staleBody = JSON.stringify(data.body)

    const stale = await worker.fetch(data.path, {
      method: 'PATCH',
      headers,
      body: staleBody
    })

    expect(stale.status).toBe(409)
    await expect(stale.text()).resolves.toContain('item_revision_conflict')
  })

  it.each([{
    signedIn: false,
    expectedStatus: 401
  }, {
    signedIn: true,
    expectedStatus: 403
  }])('rejects editor reads and writes with signedIn=$signedIn', async ({ signedIn, expectedStatus }) => {
    const data = await fixture(false)

    const cookies = {
      true: data.cookie,
      false: ''
    }

    const headers = {
      cookie: cookies[`${signedIn}`],
      origin,
      accept: 'application/json',
      'content-type': 'application/json'
    }

    const worker = required(harness)
    const read = await worker.fetch(`${data.path}/edit`, { headers })
    const updateBody = JSON.stringify(data.body)

    const write = await worker.fetch(data.path, {
      method: 'PATCH',
      headers,
      body: updateBody
    })

    expect(read.status).toBe(expectedStatus)
    expect(write.status).toBe(expectedStatus)

    const { database } = required(isolated)
    const item = database.query.equipmentItems.findFirst({ where: { id: data.item.id } })

    await expect(item).resolves.toMatchObject({
      name: 'Original',
      revision: 0
    })
  })
})
