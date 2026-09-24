import { Buffer } from 'node:buffer'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, updateSession } from 'h3'
import * as v from 'valibot'
import { createTestHarness, type TestHarness } from 'wrangler'
import { fetch as miniflareFetch } from 'miniflare'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { emailCredentials, users } from '#server/database/schema'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'
import { createPasskeyFixture } from '../../test-utils/passkey'

const origin = 'http://localhost:8888'
const sessionSecret = 'passkeys-worker-integration-session-secret-761'

const ceremonySchema = v.object({
  ceremonyId: v.string(),
  options: v.object({ challenge: v.string() })
})

const registrationSchema = v.object({
  ceremonyId: v.string(),

  options: v.object({
    challenge: v.string(),

    rp: v.object({
      id: v.string(),
      name: v.string()
    }),

    user: v.object({ id: v.string() }),
    timeout: v.number(),
    attestation: v.string(),
    pubKeyCredParams: v.array(v.object({ alg: v.number() })),

    authenticatorSelection: v.object({
      residentKey: v.string(),
      requireResidentKey: v.boolean(),
      userVerification: v.string()
    }),

    excludeCredentials: v.array(v.object({
      id: v.string(),
      transports: v.optional(v.array(v.string()))
    }))
  })
})

const authenticationSchema = v.object({
  ceremonyId: v.string(),

  options: v.object({
    challenge: v.string(),
    rpId: v.string(),
    timeout: v.number(),
    userVerification: v.string(),
    allowCredentials: v.array(v.unknown())
  })
})

const passkeySummarySchema = v.object({
  id: v.string(),
  name: v.string(),
  createdAt: v.string(),
  lastUsedAt: v.nullable(v.string())
})

const passkeyListSchema = v.object({
  items: v.array(passkeySummarySchema),
  canRegister: v.boolean()
})

const userSchema = v.object({ userId: v.nullable(v.string()) })
let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null

// oxlint-disable-next-line init-declarations -- Created only after local database verification.
let harness: TestHarness

// oxlint-disable-next-line init-declarations -- Reset when the harness starts.
let clientNumber: number

function required<Value>(value: Value | null | undefined): Value {
  if (value === null || value === undefined) {
    throw new Error('Expected initialized test data')
  }

  return value
}

function serializeRequestBody(body: unknown): string | undefined {
  if (body === undefined) {
    return
  }

  return typeof body === 'string' ? body : JSON.stringify(body)
}

function createClient(initialCookie = '') {
  clientNumber += 1

  const ip = `203.0.113.${clientNumber}`
  let cookie = initialCookie

  return async (path: string, options: {
    body?: unknown;
    contentType?: string | null;
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST';
    requestOrigin?: string;
  } = {}) => {
    const {
      body,
      contentType = body === undefined ? null : 'application/json',
      method = body === undefined ? 'GET' : 'POST',
      requestOrigin = origin
    } = options

    const headers = new globalThis.Headers({
      origin: requestOrigin,
      'cf-connecting-ip': ip,
      cookie
    })

    if (contentType !== null) {
      headers.set('content-type', contentType)
    }

    const requestBody = serializeRequestBody(body)

    const response = await harness.fetch(`${origin}${path}`, {
      method,
      headers,
      body: requestBody,
      redirect: 'manual'
    })

    const updatedCookie = response.headers.getSetCookie().find(value => value.startsWith('perdSession='))

    if (updatedCookie !== undefined) {
      cookie = updatedCookie.split(';')[0] ?? ''
    }

    return response
  }
}

async function accountCookie(userId: string) {
  const request = new IncomingMessage(new Socket())
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

describe('passkeys in the built Nuxt Worker', () => {
  beforeAll(async () => {
    clientNumber = 0

    const originalFetch = globalThis.fetch

    // Wrangler 4.131.1 forwards outbound requests through Node fetch, which rejects Upgrade.
    // Keep actual HTTP and WebSocket traffic while using Miniflare's native upgrade bridge.
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

    isolated = await createIsolatedPostgreSQL('passkeys_worker', { httpAccess: true })
    harness = createTestHarness({
      workers: [{
        configPath: './wrangler.jsonc',

        secrets: {
          NUXT_DATABASE_URL: isolated.databaseUrl,
          NUXT_LOCAL_DATABASE: 'true',
          NUXT_SESSION_SECRET: sessionSecret,
          NUXT_PASSKEYS_ORIGIN: origin
        }
      }]
    })

    await harness.listen()
  }, 60_000)

  afterEach(({ task }) => {
    if (task.result?.state === 'fail') {
      harness.debug()
    }
  })

  afterAll(async () => {
    await harness.close()
    await isolated?.dispose()
    vi.unstubAllGlobals()
  })

  it.each([-7, -257, -8] as const)('registers, signs in, and rejects replay in Workers with algorithm %i', async (algorithm) => {
    const { database } = required(isolated)
    const accounts = await database.insert(users).values({}).returning()
    const account = required(accounts[0])

    await database.insert(emailCredentials).values({
      userId: account.id,
      email: `${account.id}@example.com`,
      passwordHash: 'fixture'
    })

    const cookie = await accountCookie(account.id)
    const owner = createClient(cookie)
    const fixture = createPasskeyFixture({ algorithm })

    const optionsResponse = await owner('/api/account/passkeys/registration/options', {
      body: { name: 'Worker key' }
    })

    expect(optionsResponse.status).toBe(200)

    const optionsJson: unknown = await optionsResponse.json()
    const enrollment = v.parse(registrationSchema, optionsJson)

    expect(enrollment.options).toMatchObject({
      rp: {
        id: 'localhost',
        name: 'Metsik'
      },

      timeout: 300_000,
      attestation: 'none',

      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required'
      },

      excludeCredentials: []
    })

    expect(enrollment.options.pubKeyCredParams.map(parameter => parameter.alg)).toStrictEqual([-7, -257, -8])

    const registration = fixture.registration(enrollment.options.challenge, {
      origin,
      rpId: 'localhost'
    })

    const saved = await owner('/api/account/passkeys/registration/verify', {
      body: {
        ceremonyId: enrollment.ceremonyId,
        credential: registration
      }
    })

    expect(saved.status).toBe(200)
    expect(saved.headers.get('cache-control')).toBe('no-store')

    const savedJson: unknown = await saved.json()
    const savedPasskey = v.parse(passkeySummarySchema, savedJson)

    const secondEnrollmentResponse = await owner('/api/account/passkeys/registration/options', {
      body: { name: 'Second Worker key' }
    })

    expect(secondEnrollmentResponse.status).toBe(200)

    const secondEnrollmentJson: unknown = await secondEnrollmentResponse.json()
    const secondEnrollment = v.parse(registrationSchema, secondEnrollmentJson)

    expect(secondEnrollment.options.excludeCredentials).toStrictEqual([{
      id: registration.id,
      transports: registration.response.transports
    }])

    const listResponse = await owner('/api/account/passkeys')
    const listJson: unknown = await listResponse.json()

    expect(listResponse.status).toBe(200)
    expect(listResponse.headers.get('cache-control')).toBe('no-store')

    expect(v.parse(passkeyListSchema, listJson)).toStrictEqual({
      items: [savedPasskey],
      canRegister: true
    })

    const anonymousList = await createClient()('/api/account/passkeys')

    expect(anonymousList.status).toBe(401)
    expect(anonymousList.headers.get('cache-control')).toBe('no-store')

    const signedIn = await owner('/api/auth/passkeys/options', { body: {} })

    expect(signedIn.status).toBe(409)

    const stranger = createClient()
    const loginOptions = await stranger('/api/auth/passkeys/options', { body: {} })

    expect(loginOptions.status).toBe(200)

    const anonymousCookieHeader = loginOptions.headers.getSetCookie().find(value => value.startsWith('perdSession='))
    const anonymousCookieValue = required(anonymousCookieHeader)
    const anonymousCookie = required(anonymousCookieValue.split(';')[0])
    const loginJson: unknown = await loginOptions.json()
    const ceremony = v.parse(authenticationSchema, loginJson)

    expect(ceremony.options).toMatchObject({
      rpId: 'localhost',
      timeout: 300_000,
      userVerification: 'required',
      allowCredentials: []
    })

    const credential = fixture.authentication(ceremony.options.challenge, {
      origin,
      rpId: 'localhost',
      userHandle: enrollment.options.user.id
    })

    const counter = Buffer.from(credential.response.authenticatorData, 'base64url').readUInt32BE(33)

    expect(counter).toBe(0)

    const signed = await stranger('/api/auth/passkeys/verify', {
      body: {
        ceremonyId: ceremony.ceremonyId,
        credential
      }
    })

    expect(signed.status).toBe(200)

    const signedJson: unknown = await signed.json()

    expect(v.parse(userSchema, signedJson).userId).toBe(account.id)

    const currentSession = await stranger('/api/user')
    const currentJson: unknown = await currentSession.json()

    expect(v.parse(userSchema, currentJson).userId).toBe(account.id)

    const replayClient = createClient(anonymousCookie)

    const replay = await replayClient('/api/auth/passkeys/verify', {
      body: {
        ceremonyId: ceremony.ceremonyId,
        credential
      }
    })

    expect(replay.status).toBe(401)

    const replaySession = await replayClient('/api/user')

    expect(replaySession.status).toBe(401)

    const invalidClient = createClient()
    const invalidOptions = await invalidClient('/api/auth/passkeys/options', { body: {} })
    const invalidJson: unknown = await invalidOptions.json()
    const invalidCeremony = v.parse(ceremonySchema, invalidJson)

    const invalidCredential = fixture.authentication(invalidCeremony.options.challenge, {
      origin,
      rpId: 'localhost',
      userHandle: 'wrong-handle'
    })

    const failed = await invalidClient('/api/auth/passkeys/verify', {
      body: {
        ceremonyId: invalidCeremony.ceremonyId,
        credential: invalidCredential
      }
    })

    expect(failed.status).toBe(401)

    const failedSession = await invalidClient('/api/user')

    expect(failedSession.status).toBe(401)

    invalidCredential.response.userHandle = enrollment.options.user.id

    const retry = await invalidClient('/api/auth/passkeys/verify', {
      body: {
        ceremonyId: invalidCeremony.ceremonyId,
        credential: invalidCredential
      }
    })

    expect(retry.status).toBe(401)

    const otherAccounts = await database.insert(users).values({}).returning()
    const otherAccount = required(otherAccounts[0])

    await database.insert(emailCredentials).values({
      userId: otherAccount.id,
      email: `${otherAccount.id}@example.com`,
      passwordHash: 'fixture'
    })

    const otherAccountCookie = await accountCookie(otherAccount.id)
    const otherOwner = createClient(otherAccountCookie)

    const unauthorizedRename = await otherOwner(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'PATCH',
      body: { name: 'Stolen key' }
    })

    expect(unauthorizedRename.status).toBe(404)
    expect(unauthorizedRename.headers.get('cache-control')).toBe('no-store')

    const anonymousManager = createClient()

    const anonymousRename = await anonymousManager(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'PATCH',
      body: { name: 'Anonymous key' }
    })

    expect(anonymousRename.status).toBe(401)
    expect(anonymousRename.headers.get('cache-control')).toBe('no-store')

    const wrongOriginRename = await owner(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'PATCH',
      requestOrigin: 'https://evil.example',
      body: { name: 'Wrong origin' }
    })

    expect(wrongOriginRename.status).toBe(403)
    expect(wrongOriginRename.headers.get('cache-control')).toBe('no-store')

    const nonJsonRename = await owner(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'PATCH',
      contentType: 'text/plain',
      body: JSON.stringify({ name: 'Wrong content type' })
    })

    expect(nonJsonRename.status).toBe(415)
    expect(nonJsonRename.headers.get('cache-control')).toBe('no-store')

    const renamed = await owner(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'PATCH',
      body: { name: 'Renamed Worker key' }
    })

    const renamedJson: unknown = await renamed.json()
    const renamedPasskey = v.parse(passkeySummarySchema, renamedJson)

    expect(renamed.status).toBe(200)
    expect(renamed.headers.get('cache-control')).toBe('no-store')

    expect(renamedPasskey).toMatchObject({
      id: savedPasskey.id,
      name: 'Renamed Worker key',
      createdAt: savedPasskey.createdAt
    })

    expect(renamedPasskey.lastUsedAt).not.toBeNull()

    const unauthorizedDelete = await otherOwner(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'DELETE'
    })

    expect(unauthorizedDelete.status).toBe(404)
    expect(unauthorizedDelete.headers.get('cache-control')).toBe('no-store')

    const anonymousDelete = await anonymousManager(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'DELETE'
    })

    expect(anonymousDelete.status).toBe(401)
    expect(anonymousDelete.headers.get('cache-control')).toBe('no-store')

    const wrongOriginDelete = await owner(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'DELETE',
      requestOrigin: 'https://evil.example'
    })

    expect(wrongOriginDelete.status).toBe(403)
    expect(wrongOriginDelete.headers.get('cache-control')).toBe('no-store')

    const deleted = await owner(`/api/account/passkeys/${savedPasskey.id}`, {
      method: 'DELETE'
    })

    expect(deleted.status).toBe(204)
    expect(deleted.headers.get('cache-control')).toBe('no-store')
    await expect(deleted.text()).resolves.toBe('')

    const missingPage = await harness.fetch(`${origin}/__passkey_review_missing_page`, {
      headers: {
        accept: 'text/html',
        cookie
      },

      redirect: 'manual'
    })

    expect(missingPage.status).toBe(404)
    expect(missingPage.headers.get('content-type')).toContain('text/html')

    const logs = JSON.stringify(harness.getLogs())

    expect(logs).not.toContain(invalidCredential.response.signature)
    expect(logs).not.toContain(enrollment.options.user.id)
    expect(logs).not.toContain(fixture.publicKeyBase64)
  }, 30_000)

  it.each([
    {
      byteLength: 65_536,
      expectedStatus: 401
    },
    {
      byteLength: 65_537,
      expectedStatus: 413
    }
  ])('enforces the authentication verification body limit at $byteLength bytes', async ({ byteLength, expectedStatus }) => {
    const client = createClient()

    const validPayload = JSON.stringify({
      ceremonyId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477dd',

      credential: {
        id: 'credential',
        rawId: 'credential',
        type: 'public-key',
        clientExtensionResults: {},

        response: {
          clientDataJSON: 'client-data',
          authenticatorData: 'authenticator-data',
          signature: 'signature',
          userHandle: 'user-handle'
        }
      }
    })

    const padding = ' '.repeat(byteLength - Buffer.byteLength(validPayload))

    const response = await client('/api/auth/passkeys/verify', {
      method: 'POST',
      body: `${validPayload}${padding}`
    })

    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
