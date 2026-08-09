import { afterEach, describe, expect, it, vi } from 'vitest'
import getUserHandler from '#server/api/user/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { getSessionUserMock } = vi.hoisted(() => {
  return {
    getSessionUserMock: vi.fn()
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    getSessionUser: getSessionUserMock
  }
})

describe('get /api/user', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return the stored account type', async () => {
    getSessionUserMock.mockResolvedValue({
      isAdmin: false,
      isGuest: true,
      userId: 'user-1'
    })

    const result = await getUserHandler(createTestEvent({}))

    expect(result).toStrictEqual({
      isAdmin: false,
      isGuest: true,
      userId: 'user-1'
    })
  })
})
