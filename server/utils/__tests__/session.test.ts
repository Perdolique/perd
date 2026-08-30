import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateAppSession } from '#server/utils/session'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { updateSessionMock } = vi.hoisted(() => {
  return {
    updateSessionMock: vi.fn()
  }
})

vi.mock(import('h3'), async (importOriginal) => {
  const h3 = await importOriginal()

  return {
    ...h3,
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
    const event = createTestEvent({})

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
    }, sessionData)
  })
})
