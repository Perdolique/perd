import { createError } from 'nuxt/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import galleryHandler from '#server/api/equipment/items/[id]/gallery.get'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { validateSessionUserMock } = vi.hoisted(() => {
  return {
    validateSessionUserMock: vi.fn<(event: unknown) => Promise<string>>()
  }
})

vi.mock(import('#server/utils/session'), () => {
  return { validateSessionUser: validateSessionUserMock }
})

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

function createGalleryEvent(item?: unknown, id = itemId) {
  const findFirstMock = vi.fn().mockResolvedValue(item)

  const dbHttp = {
    query: {
      equipmentItems: {
        findFirst: findFirstMock
      }
    }
  }

  const event = createTestEvent(dbHttp)

  event.context.params = { id }

  return {
    event,
    findFirstMock
  }
}

describe('get /api/equipment/items/[id]/gallery', () => {
  beforeEach(() => {
    validateSessionUserMock.mockReset()
    validateSessionUserMock.mockResolvedValue('0195f6e8-8f44-74f6-bc9a-5c8f7df477aa')
  })

  it('returns only ordered published image metadata for a signed-in user', async () => {
    const images = [{
      cloudflareImageId: 'published-primary',
      displayOrder: 0,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
      createdAt: '2026-10-01T12:00:00.000Z'
    }, {
      cloudflareImageId: 'published-second',
      displayOrder: 1,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',
      createdAt: '2026-10-01T13:00:00.000Z'
    }]

    const { event, findFirstMock } = createGalleryEvent({
      id: itemId,
      images,

      photoSubmissions: [{
        cloudflareImageId: 'private-pending',
        status: 'pending'
      }, {
        cloudflareImageId: 'private-rejected',
        rejectionReason: 'Private review notes',
        status: 'rejected'
      }]
    })

    const result = await galleryHandler(event)

    expect(result).toStrictEqual([{
      cloudflareImageId: 'published-primary',
      displayOrder: 0,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1'
    }, {
      cloudflareImageId: 'published-second',
      displayOrder: 1,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2'
    }])

    expect(validateSessionUserMock).toHaveBeenCalledWith(event)

    expect(findFirstMock).toHaveBeenCalledExactlyOnceWith({
      columns: {
        id: true
      },

      where: {
        id: itemId,
        status: 'approved'
      },

      with: {
        images: {
          columns: {
            cloudflareImageId: true,
            displayOrder: true,
            id: true
          },

          orderBy: {
            displayOrder: 'asc'
          }
        }
      }
    })
  })

  it('returns an empty array for an approved item without published images', async () => {
    const { event } = createGalleryEvent({
      id: itemId,
      images: []
    })

    await expect(galleryHandler(event)).resolves.toStrictEqual([])
  })

  it('returns 404 when no approved item matches', async () => {
    const { event } = createGalleryEvent()

    await expect(galleryHandler(event)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects requests without a session before reading the gallery', async () => {
    const { event, findFirstMock } = createGalleryEvent({
      id: itemId,
      images: []
    })

    validateSessionUserMock.mockRejectedValue(createError({ status: 401 }))
    await expect(galleryHandler(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it('validates the route ID before querying the database', async () => {
    const { event, findFirstMock } = createGalleryEvent(undefined, 'invalid-id')

    await expect(galleryHandler(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it('preserves database failures for server error reporting', async () => {
    const { event, findFirstMock } = createGalleryEvent()
    const databaseError = new Error('Database connection failed')

    findFirstMock.mockRejectedValue(databaseError)
    await expect(galleryHandler(event)).rejects.toBe(databaseError)
  })
})
