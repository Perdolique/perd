import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateAppSession, validateSessionUser } from '#server/utils/session'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { clearSessionMock, updateSessionMock, useSessionMock } = vi.hoisted(() => {
  return {
    clearSessionMock: vi.fn(),
    updateSessionMock: vi.fn(),
    useSessionMock: vi.fn()
  }
})

vi.mock(import('h3'), async (importOriginal) => {
  const h3 = await importOriginal()

  return {
    ...h3,
    clearSession: clearSessionMock,
    useSession: useSessionMock,
    updateSession: updateSessionMock
  }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    getRuntimeSessionSecret: () => 'a'.repeat(32)
  }
})

describe(updateAppSession, () => {
  afterEach(() => {
    vi.restoreAllMocks()
    updateSessionMock.mockReset()
  })

  it('should allow session cookies on safe cross-site top-level navigations', async () => {
    const findFirst = vi.fn().mockResolvedValue({ sessionVersion: 3 })

    const event = createTestEvent({
      query: {
        users: { findFirst }
      }
    })

    const sessionData = {
      userId: 'user-1'
    }

    await updateAppSession(event, sessionData)

    expect(updateSessionMock).toHaveBeenCalledWith(event, {
      password: 'a'.repeat(32),
      name: 'perdSession',

      cookie: {
        sameSite: 'lax',
        httpOnly: true,
        secure: true
      }
    }, {
      sessionVersion: 3,
      userId: 'user-1'
    })

    expect(findFirst).toHaveBeenCalledWith({
      columns: {
        sessionVersion: true
      },

      where: {
        id: 'user-1'
      }
    })
  })

  it('should reuse a known session version without another user lookup', async () => {
    const findFirst = vi.fn()

    const event = createTestEvent({
      query: {
        users: { findFirst }
      }
    })

    await updateAppSession(event, {
      sessionVersion: 4,
      userId: 'user-1'
    })

    expect(findFirst).not.toHaveBeenCalled()

    expect(updateSessionMock).toHaveBeenCalledWith(event, expect.any(Object), {
      sessionVersion: 4,
      userId: 'user-1'
    })
  })
})

describe(validateSessionUser, () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetAllMocks()
  })

  it('should accept a matching session version and cache the result for the request', async () => {
    const findFirst = vi.fn().mockResolvedValue({ sessionVersion: 2 })

    const event = createTestEvent({
      query: {
        users: { findFirst }
      }
    })

    useSessionMock.mockResolvedValue({
      data: {
        sessionVersion: 2,
        userId: 'user-1'
      }
    })

    await expect(validateSessionUser(event)).resolves.toBe('user-1')
    await expect(validateSessionUser(event)).resolves.toBe('user-1')
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it('should treat a legacy session without a version as version zero', async () => {
    const event = createTestEvent({
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ sessionVersion: 0 })
        }
      }
    })

    useSessionMock.mockResolvedValue({
      data: { userId: 'user-1' }
    })

    await expect(validateSessionUser(event)).resolves.toBe('user-1')
  })

  it('should clear and reject a stale session after password recovery', async () => {
    const event = createTestEvent({
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({ sessionVersion: 4 })
        }
      }
    })

    useSessionMock.mockResolvedValue({
      data: {
        sessionVersion: 3,
        userId: 'user-1'
      }
    })

    await expect(validateSessionUser(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(clearSessionMock).toHaveBeenCalledTimes(1)
  })
})
