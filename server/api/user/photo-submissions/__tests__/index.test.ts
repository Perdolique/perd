import { beforeEach, describe, expect, it, vi } from 'vitest'
import listUserPhotoSubmissionsHandler from '#server/api/user/photo-submissions/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { validateRegisteredUserMock } = vi.hoisted(() => {
  return {
    validateRegisteredUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

vi.mock(import('#server/utils/user'), () => {
  return { validateRegisteredUser: validateRegisteredUserMock }
})

describe('get /api/user/photo-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateRegisteredUserMock.mockResolvedValue('user-1')
  })

  it('should list only the owner submissions newest first without exposing the image ID', async () => {
    const findManyMock = vi.fn(() => [{
      cloudflareImageId: 'must-not-leak',
      createdAt: new Date('2026-08-10T12:00:00Z'),
      filename: 'PocketRocket official.webp',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',

      item: {
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'PocketRocket Deluxe'
      },

      sourceType: 'manufacturer',
      sourceUrl: 'https://www.msrgear.com/products/pocketrocket',
      status: 'pending',
      updatedAt: new Date('2026-08-10T12:00:00Z')
    }, {
      createdAt: new Date('2026-08-09T12:00:00Z'),
      filename: 'PocketRocket camp.webp',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',

      item: {
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'PocketRocket Deluxe'
      },

      sourceType: 'own',
      sourceUrl: null,
      status: 'pending',
      updatedAt: new Date('2026-08-09T12:00:00Z')
    }])

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: { findMany: findManyMock }
      }
    })

    const result = await listUserPhotoSubmissionsHandler(event)

    expect(validateRegisteredUserMock).toHaveBeenCalledWith(event)
    expect(findManyMock).toHaveBeenCalledWith({
      columns: {
        createdAt: true,
        filename: true,
        id: true,
        sourceType: true,
        sourceUrl: true,
        status: true,
        updatedAt: true
      },

      where: {
        createdBy: 'user-1',

        item: {
          status: 'approved'
        }
      },

      orderBy: {
        createdAt: 'desc',
        id: 'desc'
      },

      with: {
        item: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    })
    expect(result).toStrictEqual({
      items: [{
        createdAt: new Date('2026-08-10T12:00:00Z'),
        filename: 'PocketRocket official.webp',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
          name: 'PocketRocket Deluxe'
        },

        sourceType: 'manufacturer',
        sourceUrl: 'https://www.msrgear.com/products/pocketrocket',
        status: 'pending',
        updatedAt: new Date('2026-08-10T12:00:00Z')
      }, {
        createdAt: new Date('2026-08-09T12:00:00Z'),
        filename: 'PocketRocket camp.webp',
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',

        item: {
          id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
          name: 'PocketRocket Deluxe'
        },

        sourceType: 'own',
        sourceUrl: null,
        status: 'pending',
        updatedAt: new Date('2026-08-09T12:00:00Z')
      }]
    })
    expect(JSON.stringify(result)).not.toContain('cloudflareImageId')
  })

  it('should stop before querying when registered user validation fails', async () => {
    const authError = new Error('registered account required')
    const findManyMock = vi.fn()

    validateRegisteredUserMock.mockRejectedValue(authError)

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: { findMany: findManyMock }
      }
    })

    await expect(listUserPhotoSubmissionsHandler(event)).rejects.toBe(authError)
    expect(findManyMock).not.toHaveBeenCalled()
  })
})
