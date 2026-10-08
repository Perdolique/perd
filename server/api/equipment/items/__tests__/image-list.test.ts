import type { getValidatedRouteParams } from '#server/utils/request'
import * as nuxtServer from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import imageListHandler from '#server/api/equipment/items/[id]/images/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { getValidatedRouteParamsMock, validateAdminUserMock } = vi.hoisted(() => {
  return {
    getValidatedRouteParamsMock: vi.fn<typeof getValidatedRouteParams>(),
    validateAdminUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

// @ts-expect-error -- The test mock specializes the validator's generic result.
vi.mock(import('#server/utils/request'), () => {
  return {
    getValidatedRouteParams: getValidatedRouteParamsMock
  }
})

vi.mock(import('#server/utils/admin'), () => {
  return {
    validateAdminUser: validateAdminUserMock
  }
})

describe('get /api/equipment/items/[id]/images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('0195f6e8-8f44-74f6-bc9a-5c8f7df477aa')

    getValidatedRouteParamsMock.mockResolvedValue({
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

  it('keeps the management read unavailable to non-administrators', async () => {
    const findManyMock = vi.fn()

    const event = createTestEvent({
      query: {
        equipmentItemImages: {
          findMany: findManyMock
        }
      }
    })

    validateAdminUserMock.mockRejectedValueOnce(nuxtServer.createError({ status: 403 }))
    await expect(imageListHandler(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(findManyMock).not.toHaveBeenCalled()
  })
})
