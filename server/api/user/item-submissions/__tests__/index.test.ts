import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import listUserItemSubmissionsHandler from '#server/api/user/item-submissions/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { validateRegisteredUserMock } = vi.hoisted(() => {
  return {
    validateRegisteredUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

vi.mock(import('#server/utils/user'), () => {
  return { validateRegisteredUser: validateRegisteredUserMock }
})

describe('get /api/user/item-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateRegisteredUserMock.mockResolvedValue('user-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should list only the registered owner submissions newest first with final data', async () => {
    const findManyMock = vi.fn(() => [{
      brand: {
        id: 1,
        name: 'MSR'
      },

      category: {
        id: 2,
        name: 'Stoves'
      },

      createdAt: new Date('2026-08-01T12:00:00Z'),
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      name: 'PocketRocket Deluxe',

      propertyValues: [{
        property: {
          name: 'Weight',
          unit: 'g'
        },

        propertyId: 3,
        valueBoolean: null,
        valueNumber: '83.5',
        valueText: null
      }, {
        property: {
          name: 'Piezo ignition',
          unit: null
        },

        propertyId: 4,
        valueBoolean: false,
        valueNumber: null,
        valueText: null
      }],

      rejectionReason: 'Duplicate catalog item',
      status: 'rejected',
      updatedAt: new Date('2026-08-02T12:00:00Z')
    }])

    const event = createTestEvent({
      query: {
        equipmentItems: { findMany: findManyMock }
      }
    })

    const result = await listUserItemSubmissionsHandler(event)

    expect(validateRegisteredUserMock).toHaveBeenCalledWith(event)

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: {
        createdAt: 'desc',
        id: 'desc'
      },

      where: {
        createdBy: 'user-1',

        status: {
          in: ['approved', 'pending', 'rejected']
        }
      }
    }))

    expect(result).toStrictEqual({
      items: [{
        brand: {
          id: 1,
          name: 'MSR'
        },

        category: {
          id: 2,
          name: 'Stoves'
        },

        createdAt: new Date('2026-08-01T12:00:00Z'),
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'PocketRocket Deluxe',

        properties: [{
          name: 'Weight',
          propertyId: 3,
          unit: 'g',
          value: '83.5'
        }, {
          name: 'Piezo ignition',
          propertyId: 4,
          unit: null,
          value: false
        }],

        rejectionReason: 'Duplicate catalog item',
        status: 'rejected',
        updatedAt: new Date('2026-08-02T12:00:00Z')
      }]
    })
  })

  it('should stop before querying when registered user validation fails', async () => {
    const authError = new Error('registered account required')
    const findManyMock = vi.fn()

    validateRegisteredUserMock.mockRejectedValue(authError)

    const event = createTestEvent({
      query: {
        equipmentItems: { findMany: findManyMock }
      }
    })

    await expect(listUserItemSubmissionsHandler(event)).rejects.toBe(authError)
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it.each(['approved', 'pending', 'rejected'])(
    'should preserve the %s submission status',
    async (status) => {
      const findManyMock = vi.fn(() => [{
        brand: {
          id: 1,
          name: 'MSR'
        },

        category: {
          id: 2,
          name: 'Stoves'
        },

        createdAt: new Date('2026-08-01T12:00:00Z'),
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        name: 'PocketRocket Deluxe',
        propertyValues: [],
        rejectionReason: null,
        status,
        updatedAt: new Date('2026-08-02T12:00:00Z')
      }])

      const event = createTestEvent({
        query: {
          equipmentItems: { findMany: findManyMock }
        }
      })

      const result = await listUserItemSubmissionsHandler(event)

      expect(result.items[0]?.status).toBe(status)
    }
  )
})
