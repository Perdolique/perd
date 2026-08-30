import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import detailHandler from '#server/api/equipment/photo-submissions/[id].get'
import previewHandler from '#server/api/equipment/photo-submissions/[id]/image.get'
import listHandler from '#server/api/equipment/photo-submissions/index.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const submissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const cursorSubmissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d6'

const {
  getCloudflareImagesBindingMock,
  getValidatedQueryMock,
  getValidatedRouterParamsMock,
  validateAdminUserMock
} = vi.hoisted(() => {
  return {
    getCloudflareImagesBindingMock: vi.fn(),
    getValidatedQueryMock: vi.fn<typeof h3.getValidatedQuery>(),
    getValidatedRouterParamsMock: vi.fn<typeof h3.getValidatedRouterParams>(),
    validateAdminUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async getValidatedQuery(...args: Parameters<typeof h3.getValidatedQuery>) {
      return getValidatedQueryMock(...args)
    },

    async getValidatedRouterParams(...args: Parameters<typeof h3.getValidatedRouterParams>) {
      return getValidatedRouterParamsMock(...args)
    }
  }
})

vi.mock(import('#server/utils/admin'), () => {
  return { validateAdminUser: validateAdminUserMock }
})

vi.mock(import('#server/utils/cloudflare'), () => {
  return { getCloudflareImagesBinding: getCloudflareImagesBindingMock }
})

function createListDb(items: unknown[]) {
  const findManyMock = vi.fn(() => items)

  return {
    dbHttp: {
      query: {
        equipmentItemPhotoSubmissions: { findMany: findManyMock }
      }
    },

    findManyMock
  }
}

function createDetailSubmission() {
  return {
    cloudflareImageId: 'must-not-leak',
    createdAt: new Date('2026-08-01T12:00:00Z'),

    creator: {
      id: 'author-1',
      name: 'Ada'
    },

    filename: 'pocketrocket.webp',
    id: submissionId,

    item: {
      brand: {
        id: 1,
        name: 'MSR'
      },

      category: {
        id: 2,
        name: 'Stoves'
      },

      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
      images: [{ id: 'image-1' }],
      name: 'PocketRocket Deluxe'
    },

    rightsConfirmed: true,
    sourceType: 'manufacturer',
    sourceUrl: 'https://www.msrgear.com/pocketrocket',
    updatedAt: new Date('2026-08-01T12:30:00Z')
  }
}

describe('admin equipment photo submission reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateAdminUserMock.mockResolvedValue('admin-1')

    getValidatedQueryMock.mockResolvedValue({
      afterCreatedAt: '2026-07-31T12:00:00.000Z',
      afterId: cursorSubmissionId,
      limit: 1
    })

    getValidatedRouterParamsMock.mockResolvedValue({ id: submissionId })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should list only pending submissions oldest-first without private image IDs', async () => {
    const submission = createDetailSubmission()

    const secondSubmission = {
      ...submission,
      createdAt: new Date('2026-08-02T12:00:00Z'),
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
    }

    const { dbHttp, findManyMock } = createListDb([
      submission,
      secondSubmission
    ])

    const event = createTestEvent(dbHttp)
    const result = await listHandler(event)

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 2,

      orderBy: {
        createdAt: 'asc',
        id: 'asc'
      },

      where: {
        status: 'pending',

        OR: [
          {
            createdAt: {
              gt: new Date('2026-07-31T12:00:00.000Z')
            }
          },
          {
            createdAt: {
              eq: new Date('2026-07-31T12:00:00.000Z')
            },

            id: {
              gt: cursorSubmissionId
            }
          }
        ]
      }
    }))

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.author?.name).toBe('Ada')

    expect(result.nextCursor).toStrictEqual({
      createdAt: '2026-08-01T12:00:00.000Z',
      id: submissionId
    })

    expect(JSON.stringify(result)).not.toContain('must-not-leak')
  })

  it('should return review metadata and an internal preview URL without the Cloudflare ID', async () => {
    const findFirstMock = vi.fn(() => createDetailSubmission())

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: { findFirst: findFirstMock }
      }
    })

    const result = await detailHandler(event)

    expect(findFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: submissionId,
        status: 'pending'
      }
    }))

    expect(result.hasExistingImages).toBe(true)
    expect(result.previewUrl).toBe(`/api/equipment/photo-submissions/${submissionId}/image`)
    expect(result.rightsConfirmed).toBe(true)
    expect(JSON.stringify(result)).not.toContain('must-not-leak')
  })

  it('should stream private image bytes with detected MIME and no-store caching', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const bytesMock = vi.fn(() => new Response(bytes).body)

    const infoMock = vi.fn(async (stream: ReadableStream<Uint8Array>) => {
      await new Response(stream).arrayBuffer()

      return {
        fileSize: bytes.length,
        format: 'image/webp',
        height: 1,
        width: 1
      }
    })

    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        image: vi.fn(() => {
          return { bytes: bytesMock }
        })
      },

      info: infoMock
    })

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: {
          findFirst: vi.fn(() => {
            return { cloudflareImageId: 'private-image' }
          })
        }
      }
    })

    const response = await previewHandler(event)

    expect(new Uint8Array(await response.arrayBuffer())).toStrictEqual(bytes)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('should return 404 when the hosted image is missing', async () => {
    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        image: vi.fn(() => {
          return {
            bytes: vi.fn(() => null)
          }
        })
      }
    })

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: {
          findFirst: vi.fn(() => {
            return { cloudflareImageId: 'missing-image' }
          })
        }
      }
    })

    await expect(previewHandler(event)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('should log the provider error and return a safe preview failure', async () => {
    const providerError = Object.assign(new Error('provider secret'), {
      statusCode: 404
    })

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected provider failure telemetry.
    })

    getCloudflareImagesBindingMock.mockReturnValue({
      hosted: {
        image: vi.fn(() => {
          return {
            bytes: vi.fn(() => new Response(new Uint8Array([1])).body)
          }
        })
      },

      info: vi.fn().mockRejectedValue(providerError)
    })

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: {
          findFirst: vi.fn(() => {
            return { cloudflareImageId: 'private-image' }
          })
        }
      }
    })

    await expect(previewHandler(event)).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Photo preview unavailable'
    })

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to load private equipment photo submission image',
      {
        error: providerError,
        submissionId
      }
    )
  })

  it('should stop all reads before database access when admin validation fails', async () => {
    const authError = h3.createError({ status: 403 })
    const findManyMock = vi.fn()
    const findFirstMock = vi.fn()

    validateAdminUserMock.mockRejectedValue(authError)

    const event = createTestEvent({
      query: {
        equipmentItemPhotoSubmissions: {
          findFirst: findFirstMock,
          findMany: findManyMock
        }
      }
    })

    await expect(listHandler(event)).rejects.toBe(authError)
    await expect(detailHandler(event)).rejects.toBe(authError)
    await expect(previewHandler(event)).rejects.toBe(authError)
    expect(findManyMock).not.toHaveBeenCalled()
    expect(findFirstMock).not.toHaveBeenCalled()
  })
})
