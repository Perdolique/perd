import type * as h3 from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import listUserPhotoSubmissionsHandler from '#server/api/user/photo-submissions/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const {
  getValidatedQueryMock,
  validateRegisteredUserMock
} = vi.hoisted(() => {
  return {
    getValidatedQueryMock: vi.fn<typeof h3.getValidatedQuery>(),
    validateRegisteredUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedQuery(...args: Parameters<typeof h3.getValidatedQuery>) {
      return getValidatedQueryMock(...args)
    }
  }
})

vi.mock(import('#server/utils/user'), () => {
  return { validateRegisteredUser: validateRegisteredUserMock }
})

function createPhotoSubmission(index: number) {
  return {
    cloudflareImageId: `must-not-leak-${index}`,
    createdAt: new Date(`2026-08-${String(index + 1).padStart(2, '0')}T12:00:00Z`),
    filename: `Photo ${index}.webp`,
    id: `submission-${index}`,

    item: {
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
      name: 'PocketRocket Deluxe'
    },

    rejectionReason: null,
    sourceType: index % 2 === 0 ? 'manufacturer' : 'own',
    sourceUrl: index % 2 === 0 ? 'https://www.msrgear.com/products/pocketrocket' : null,
    status: 'pending',
    updatedAt: new Date(`2026-08-${String(index + 1).padStart(2, '0')}T12:00:00Z`)
  }
}

describe('get /api/user/photo-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getValidatedQueryMock.mockResolvedValue({ page: 2 })
    validateRegisteredUserMock.mockResolvedValue('user-1')
  })

  it('should return one private owner page and signal the next page', async () => {
    const findManyMock = vi.fn(() => Array.from(
      { length: 21 },
      (_value, index) => createPhotoSubmission(index)
    ))

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: { findMany: findManyMock }
      }
    })

    const result = await listUserPhotoSubmissionsHandler(event)

    expect(validateRegisteredUserMock).toHaveBeenCalledWith(event)
    expect(getValidatedQueryMock).toHaveBeenCalledWith(event, expect.any(Function))

    expect(findManyMock).toHaveBeenCalledWith({
      columns: {
        createdAt: true,
        filename: true,
        id: true,
        rejectionReason: true,
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

      limit: 21,
      offset: 20,

      with: {
        item: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    })

    expect(result.items).toHaveLength(20)
    expect(result.nextPage).toBe(3)
    expect(JSON.stringify(result)).not.toContain('cloudflareImageId')
  })

  it('should return a null next page for the final page', async () => {
    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: {
          findMany: vi.fn(() => [createPhotoSubmission(0)])
        }
      }
    })

    const result = await listUserPhotoSubmissionsHandler(event)

    expect(result.items).toHaveLength(1)
    expect(result.nextPage).toBeNull()
  })

  it.each([
    ['approved', null],
    ['pending', null],
    ['rejected', 'Not a usable product photo']
  ] as const)('should expose the %s owner status without leaking the private image id', async (
    status,
    rejectionReason
  ) => {
    const submission = {
      ...createPhotoSubmission(0),
      rejectionReason,
      status
    }

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: {
          findMany: vi.fn(() => [submission])
        }
      }
    })

    const result = await listUserPhotoSubmissionsHandler(event)

    expect(result.items[0]?.status).toBe(status)
    expect(result.items[0]?.rejectionReason).toBe(rejectionReason)
    expect(JSON.stringify(result)).not.toContain('must-not-leak')
  })

  it('should stop before query validation and database access when auth fails', async () => {
    const authError = new Error('registered account required')
    const findManyMock = vi.fn()

    validateRegisteredUserMock.mockRejectedValue(authError)

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: { findMany: findManyMock }
      }
    })

    await expect(listUserPhotoSubmissionsHandler(event)).rejects.toBe(authError)
    expect(getValidatedQueryMock).not.toHaveBeenCalled()
    expect(findManyMock).not.toHaveBeenCalled()
  })
})
