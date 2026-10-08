import { createAccountCookie } from '../../test-utils/create-account-cookie'
import * as v from 'valibot'
import { createTestHarness, type TestHarness } from 'wrangler'
import { fetch as miniflareFetch } from 'miniflare'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { equipmentCategories, users } from '#server/database/schema'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

const origin = 'http://localhost:8888'
const sessionSecret = 'characteristics-worker-integration-session-secret-812'

const snapshotSchema = v.object({
  category: v.object({ propertiesRevision: v.number() }),

  properties: v.array(v.object({
    id: v.number(),
    slug: v.string(),
    usedItemCount: v.number(),

    enumOptions: v.array(v.object({
      id: v.number(),
      slug: v.string()
    }))
  }))
})

let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null
let harness: TestHarness | null = null

function required<Value>(value: Value | null | undefined): Value {
  if (value === null || value === undefined) {
    throw new Error('Expected initialized test data')
  }

  return value
}

async function readSnapshot(response: Awaited<ReturnType<TestHarness['fetch']>>, status = 200) {
  const body = await response.text()

  expect({
    status: response.status,
    body
  }).toMatchObject({ status })

  const json: unknown = JSON.parse(body)

  return v.parse(snapshotSchema, json)
}

async function createCharacteristic() {
  const { database } = required(isolated)
  const worker = required(harness)
  const [account] = await database.insert(users).values({ isAdmin: true }).returning()
  const admin = required(account)

  const [createdCategory] = await database.insert(equipmentCategories).values({
    name: 'Worker test',
    slug: admin.id
  }).returning()

  const category = required(createdCategory)
  const cookie = await createAccountCookie(admin.id, sessionSecret)
  const path = `${origin}/api/equipment/categories/${category.id}/properties`

  const body = JSON.stringify({
    name: 'New characteristic',
    slug: 'new-characteristic',
    dataType: 'enum',
    expectedPropertiesRevision: 0,

    enumOptions: [{
      name: 'First',
      slug: 'first'
    }, {
      name: 'Second',
      slug: 'second'
    }]
  })

  const response = await worker.fetch(path, {
    method: 'POST',

    headers: {
      cookie,
      'content-type': 'application/json',
      origin
    },

    body
  })

  const created = await readSnapshot(response, 201)
  const property = required(created.properties[0])

  expect(property).toMatchObject({
    slug: 'new-characteristic',
    usedItemCount: 0
  })

  return {
    worker,
    cookie,
    path,
    property,
    revision: created.category.propertiesRevision
  }
}

describe('characteristics in the built Nuxt Worker', () => {
  beforeAll(async () => {
    const originalFetch = globalThis.fetch

    // Keep real database traffic while bridging Wrangler's outbound WebSocket upgrades.
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new globalThis.Headers(init?.headers)

      if (headers.get('upgrade') === 'websocket') {
        const request = new globalThis.Request(input, init)

        return miniflareFetch(request.url, {
          method: request.method,
          headers: Object.fromEntries(headers)
        })
      }

      return originalFetch(input, init)
    })

    isolated = await createIsolatedPostgreSQL('characteristics_worker', { httpAccess: true })
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
    await harness?.close()
    await isolated?.dispose()
    vi.unstubAllGlobals()
  })

  it('deletes a newly created characteristic and persists the empty list', async () => {
    const { worker, cookie, path, property, revision } = await createCharacteristic()

    const response = await worker.fetch(`${path}/${property.id}?expectedPropertiesRevision=${revision}&expectedAffectedItemCount=0`, {
      method: 'DELETE',
      headers: { cookie }
    })

    const snapshot = await readSnapshot(response)

    expect(snapshot).toStrictEqual({
      category: { propertiesRevision: 2 },
      properties: []
    })

    const readResponse = await worker.fetch(path, { headers: { cookie } })
    const saved = await readSnapshot(readResponse)

    expect(saved).toStrictEqual(snapshot)
  })

  it('deletes a newly created unused enum option and keeps the other option', async () => {
    const { worker, cookie, path, property, revision } = await createCharacteristic()
    const first = required(property.enumOptions[0])
    const second = required(property.enumOptions[1])

    const response = await worker.fetch(`${path}/${property.id}/enum-options/${second.id}?expectedPropertiesRevision=${revision}`, {
      method: 'DELETE',
      headers: { cookie }
    })

    const snapshot = await readSnapshot(response)

    expect(snapshot.category.propertiesRevision).toBe(2)
    expect(snapshot.properties[0]?.enumOptions).toStrictEqual([first])

    const readResponse = await worker.fetch(path, { headers: { cookie } })
    const saved = await readSnapshot(readResponse)

    expect(saved).toStrictEqual(snapshot)
  })
})
