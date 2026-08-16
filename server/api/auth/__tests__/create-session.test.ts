import type * as h3 from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import createGuestSessionHandler from '#server/api/auth/create-session.post'
import { users } from '#server/database/schema'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { setResponseStatusMock, sessionUpdateMock, useAppSessionMock } = vi.hoisted(() => {
  return {
    setResponseStatusMock: vi.fn<typeof h3.setResponseStatus>(),
    sessionUpdateMock: vi.fn(),
    useAppSessionMock: vi.fn()
  }
})

vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    setResponseStatus(...args: Parameters<typeof h3.setResponseStatus>) {
      setResponseStatusMock(...args)
    }
  }
})

vi.mock(import('#server/utils/session'), () => {
  return {
    useAppSession: useAppSessionMock
  }
})

describe('post /api/auth/create-session', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create and return an explicit Guest account', async () => {
    const returningMock = vi.fn(() => [{
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
    }])

    const valuesMock = vi.fn(() => {
      return { returning: returningMock }
    })

    const insertMock = vi.fn((table: unknown) => {
      expect(table).toBe(users)

      return { values: valuesMock }
    })

    const event = createTestEvent({ insert: insertMock })

    useAppSessionMock.mockResolvedValue({ update: sessionUpdateMock })

    const result = await createGuestSessionHandler(event)

    expect(valuesMock).toHaveBeenCalledWith({})
    expect(sessionUpdateMock).toHaveBeenCalledWith({
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
    })
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
    expect(result).toStrictEqual({
      isGuest: true,
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
    })
  })
})
