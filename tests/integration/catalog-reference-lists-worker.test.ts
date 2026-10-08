import { createAccountCookie } from '../../test-utils/create-account-cookie'
import { createTestHarness, type TestHarness } from 'wrangler'
import { fetch as miniflareFetch } from 'miniflare'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { equipmentCategories, equipmentGroups, users } from '#server/database/schema'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

interface ReferenceListItem {
  id: number;
  name: string;
  slug: string;
}

interface ReferenceLists {
  categories: ReferenceListItem;
  groups: ReferenceListItem;
  cookie: string;
  userId: string;
}

const origin = 'http://localhost:8888'
const sessionSecret = 'nuxt-server-reference-list-session-secret-2026'
let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null
let harness: TestHarness | null = null
let fixtures: ReferenceLists | null = null

function required<Value>(value: Value | null | undefined): Value {
  if (value === null || value === undefined) {
    throw new Error('Expected initialized reference-list data')
  }

  return value
}

describe('portable catalog reference lists in the Worker', () => {
  beforeAll(async () => {
    const originalFetch = globalThis.fetch

    // Keep real database traffic while bridging Wrangler's outbound WebSocket upgrades.
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new globalThis.Headers(init?.headers)

      if (headers.get('upgrade') === 'websocket') {
        const request = new globalThis.Request(input, init)
        const requestHeaders = Object.fromEntries(headers)

        const response = miniflareFetch(request.url, {
          method: request.method,
          headers: requestHeaders
        })

        return response
      }

      const response = originalFetch(input, init)

      return response
    })

    isolated = await createIsolatedPostgreSQL('nuxt_server_lists', { httpAccess: true })

    const { database } = isolated
    const [user] = await database.insert(users).values({}).returning({ id: users.id })
    const account = required(user)
    const cookie = await createAccountCookie(account.id, sessionSecret)

    const [category] = await database.insert(equipmentCategories).values({
      name: 'Portable category',
      slug: 'portable-category'
    }).returning({ id: equipmentCategories.id })

    const [group] = await database.insert(equipmentGroups).values({
      name: 'Portable group',
      slug: 'portable-group'
    }).returning({ id: equipmentGroups.id })

    const createdCategory = required(category)
    const createdGroup = required(group)

    fixtures = {
      categories: {
        id: createdCategory.id,
        name: 'Portable category',
        slug: 'portable-category'
      },

      groups: {
        id: createdGroup.id,
        name: 'Portable group',
        slug: 'portable-group'
      },

      cookie,
      userId: account.id
    }

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

  it.each(['categories', 'groups'] as const)('returns only the public %s fields with a native Nuxt session', async (kind) => {
    const worker = required(harness)
    const referenceLists = required(fixtures)
    const url = `${origin}/api/equipment/${kind}`

    const response = await worker.fetch(url, {
      headers: { cookie: referenceLists.cookie }
    })

    expect(response.status).toBe(200)

    const body: unknown = await response.json()

    expect(body).toStrictEqual([referenceLists[kind]])
  })

  it('rejects a stale native session and expires its cookie', async () => {
    const worker = required(harness)
    const { userId } = required(fixtures)
    const cookie = await createAccountCookie(userId, sessionSecret, 99)
    const url = `${origin}/api/user`
    const response = await worker.fetch(url, { headers: { cookie } })

    expect(response.status).toBe(401)

    const setCookie = response.headers.get('set-cookie')

    expect(setCookie).toContain('perdSession=;')
    expect(setCookie).toContain('Max-Age=0')
  })

  it('expires a native session when the user logs out', async () => {
    const worker = required(harness)
    const { cookie } = required(fixtures)
    const url = `${origin}/api/auth/logout`

    const response = await worker.fetch(url, {
      method: 'POST',
      headers: { cookie }
    })

    expect(response.status).toBe(204)

    const body = response.text()

    await expect(body).resolves.toBe('')

    const setCookie = response.headers.get('set-cookie')

    expect(setCookie).toContain('perdSession=;')
    expect(setCookie).toContain('Max-Age=0')
  })
})
