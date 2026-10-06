import { createApp, createError, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '#server/api/user/packing-lists/[id]/copy.post'
import type { copyPackingList } from '#server/utils/packing-list-copy'

const { copyMock, sessionMock, closeMock, clientMock } = vi.hoisted(() => {
  const closeClient = vi.fn<() => Promise<void>>()

  return {
    closeMock: closeClient,
    copyMock: vi.fn<typeof copyPackingList>(),
    sessionMock: vi.fn<() => Promise<string>>(),

    clientMock: vi.fn(() => {
      return { $client: { end: closeClient } }
    })
  }
})

vi.mock(import('#server/utils/session'), () => {
  return { validateSessionUser: sessionMock }
})

vi.mock(import('#server/utils/packing-list-copy'), () => {
  return { copyPackingList: copyMock }
})

// @ts-expect-error -- This handler needs only the client lifecycle, not the complete Drizzle surface.
vi.mock(import('#server/utils/config'), () => {
  return { createWebSocketClientFromEvent: clientMock }
})

const ownerId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const originalId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const copyId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const now = new Date('2026-10-06T12:00:00Z')

async function request(body?: unknown, id = originalId) {
  const router = createRouter().post('/lists/:id/copy', handler)
  const app = createApp().use(router)
  const fetch = toWebHandler(app)
  const requestBody = JSON.stringify(body ?? { name: 'Copy' })

  const incoming = new Request(`http://localhost/lists/${id}/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody
  })

  return fetch(incoming)
}

describe('post packing list copy', () => {
  beforeEach(() => {
    copyMock.mockReset()
    sessionMock.mockReset().mockResolvedValue(ownerId)
    closeMock.mockReset().mockResolvedValue()

    copyMock.mockResolvedValue({
      createdAt: now,
      updatedAt: now,
      id: copyId,
      name: 'Copy',
      entryCount: 3,
      packedCount: 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 201 and the summary after trimming the name', async () => {
    const response = await request({ name: '  Copy  ' })
    const body: unknown = await response.json()

    expect(response.status).toBe(201)

    const serializedDate = now.toISOString()

    expect(body).toStrictEqual({
      createdAt: serializedDate,
      updatedAt: serializedDate,
      id: copyId,
      name: 'Copy',
      entryCount: 3,
      packedCount: 0
    })

    expect(copyMock).toHaveBeenCalledWith(clientMock.mock.results[0]?.value, {
      id: originalId,
      userId: ownerId,
      name: 'Copy'
    })

    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  const excessiveName = 'A'.repeat(129)

  it.each([{ name: '' }, { name: '   ' }, { name: excessiveName }, { name: 42 }, {}])('rejects invalid names before writing: %j', async body => {
    const response = await request(body)

    expect(response.status).toBe(400)
    expect(copyMock).not.toHaveBeenCalled()
    expect(closeMock).not.toHaveBeenCalled()
  })

  it('accepts the name length limit and rejects invalid IDs', async () => {
    const name = 'A'.repeat(128)
    const valid = await request({ name })

    expect(valid.status).toBe(201)

    expect(copyMock).toHaveBeenCalledWith(expect.anything(), {
      id: originalId,
      userId: ownerId,
      name
    })

    copyMock.mockClear()

    const invalid = await request({ name: 'Copy' }, 'invalid')

    expect(invalid.status).toBe(400)
    expect(copyMock).not.toHaveBeenCalled()
  })

  it('requires a session', async () => {
    sessionMock.mockRejectedValue(createError({ status: 401 }))

    const response = await request()

    expect(response.status).toBe(401)
    expect(copyMock).not.toHaveBeenCalled()
  })

  it.each([404, 409])('preserves expected refusal %i', async status => {
    copyMock.mockRejectedValue(createError({ status }))

    const response = await request()

    expect(response.status).toBe(status)
    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it.each(['40001', '40P01', '23503'])('maps PostgreSQL conflict %s to 409', async code => {
    const error = new Error('Private database detail', { cause: { code } })

    const log = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected diagnostics are asserted below.
    })

    copyMock.mockRejectedValue(error)

    const response = await request()
    const body = await response.text()

    expect(response.status).toBe(409)
    expect(body).not.toContain('Private database detail')
    expect(log).toHaveBeenCalledWith('Failed to copy packing list', error)
  })

  it('shows a safe 500 and logs the original error even when cleanup also fails', async () => {
    const error = new Error('Private database detail')
    const cleanup = new Error('Private connection detail')

    const log = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected diagnostics are asserted below.
    })

    copyMock.mockRejectedValue(error)
    closeMock.mockRejectedValue(cleanup)

    const response = await request()
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).not.toContain('Private database detail')
    expect(log).toHaveBeenCalledWith('Failed to copy packing list', error)
    expect(log).toHaveBeenCalledWith('Failed to close packing list copy client', cleanup)
  })

  it('logs client setup failures and returns a safe 500', async () => {
    const failure = new Error('Private connection details')

    const log = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected diagnostics are asserted below.
    })

    clientMock.mockImplementationOnce(() => {
      throw failure
    })

    const response = await request()
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).not.toContain('Private connection details')
    expect(log).toHaveBeenCalledWith('Failed to copy packing list', failure)
    expect(copyMock).not.toHaveBeenCalled()
    expect(closeMock).not.toHaveBeenCalled()
  })

  it('keeps a committed success when client cleanup fails', async () => {
    const cleanup = new Error('Connection cleanup failed')

    const log = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected diagnostics are asserted below.
    })

    closeMock.mockRejectedValue(cleanup)

    const response = await request()

    expect(response.status).toBe(201)
    expect(log).toHaveBeenCalledWith('Failed to close packing list copy client', cleanup)
  })
})
