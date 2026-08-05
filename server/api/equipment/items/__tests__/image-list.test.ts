import type * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import imageListHandler from '#server/api/equipment/items/[id]/images/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { getValidatedRouterParamsMock, validateAdminUserMock } = vi.hoisted(() => {
  return {
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    validateAdminUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

vi.mock(import('#server/utils/admin'), () => {
  return {
    validateAdminUser: validateAdminUserMock
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedRouterParams(...args: Parameters<typeof h3.getValidatedRouterParams>) {
      return getValidatedRouterParamsMock(...args)
    }
  }
})

describe('get /api/equipment/items/[id]/images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('0195f6e8-8f44-74f6-bc9a-5c8f7df477aa')
    getValidatedRouterParamsMock.mockResolvedValue({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return ordered admin image metadata', async () => {
    const findManyMock = vi.fn(() => [{
      cloudflareImageId: 'first-cloudflare-image',
      displayOrder: 0,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1'
    }])
    const dbHttp = {
      query: {
        equipmentItemImages: {
          findMany: findManyMock
        }
      }
    }
    const event = createTestEvent(dbHttp)

    const result = await imageListHandler(event)

    expect(result).toStrictEqual([{
      cloudflareImageId: 'first-cloudflare-image',
      displayOrder: 0,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1'
    }])
    expect(validateAdminUserMock).toHaveBeenCalledWith(event)
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: {
        displayOrder: 'asc'
      }
    }))
  })
})
