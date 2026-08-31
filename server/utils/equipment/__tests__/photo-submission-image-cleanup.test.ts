import { describe, expect, it, vi } from 'vitest'

import {
  cleanupPhotoSubmissionImages,
  type PhotoSubmissionImagesBinding
} from '#server/utils/equipment/photo-submission-image-cleanup'

import { photoSubmissionImageRetentionMilliseconds } from '#server/utils/equipment/photo-submission-image-metadata'

import type {
  PhotoSubmissionImageReferenceLookup,
  PhotoSubmissionImageReferences
} from '#server/utils/equipment/photo-submission-image-references'

const scheduledTime = Date.parse('2026-08-31T03:00:00.000Z')

const oldUploaded = new Date(
  scheduledTime - photoSubmissionImageRetentionMilliseconds - 1
).toISOString()

const newUploaded = new Date(
  scheduledTime - photoSubmissionImageRetentionMilliseconds + 1
).toISOString()

function createImage(overrides: Partial<ImageMetadata> = {}): ImageMetadata {
  return {
    id: 'image-1',

    meta: {
      environment: 'production',
      kind: 'equipment-photo-submission'
    },

    requireSignedURLs: true,
    uploaded: oldUploaded,
    variants: [],
    ...overrides
  }
}

function createReferences(options: {
  publishedImageIds?: string[];
  submissionStatuses?: [string, string][];
} = {}): PhotoSubmissionImageReferences {
  return {
    publishedImageIds: new Set(options.publishedImageIds),
    submissionStatuses: new Map(options.submissionStatuses)
  }
}

function createImagesBinding(options: {
  deleteMocks?: Map<string, () => Promise<boolean>>;
  pages: ImageList[];
}) {
  const deleteMocks = options.deleteMocks ?? new Map<string, () => Promise<boolean>>()
  const listMock = vi.fn<PhotoSubmissionImagesBinding['hosted']['list']>()

  for (const page of options.pages) {
    listMock.mockResolvedValueOnce(page)
  }

  const imageMock = vi.fn<PhotoSubmissionImagesBinding['hosted']['image']>((imageId) => {
    const defaultDeleteMock = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
    const deleteMock = deleteMocks.get(imageId) ?? defaultDeleteMock

    return {
      delete: deleteMock
    }
  })

  return {
    binding: {
      hosted: {
        image: imageMock,
        list: listMock
      }
    } satisfies PhotoSubmissionImagesBinding,

    imageMock,
    listMock
  }
}

describe('photo submission image cleanup', () => {
  it('should delete only expired terminal and environment-owned orphan sources', async () => {
    const page: ImageList = {
      images: [
        createImage({ id: 'orphan' }),
        createImage({
        id: 'rejected',
        meta: { kind: 'equipment-photo-submission' }
      }),
        createImage({ id: 'approved' }),
        createImage({ id: 'pending' }),
        createImage({ id: 'published' }),
        createImage({
          id: 'foreign',

          meta: {
            environment: 'staging',
            kind: 'equipment-photo-submission'
          }
        }),
        createImage({
        id: 'new',
        uploaded: newUploaded
      }),
        createImage({
        id: 'invalid-time',
        uploaded: 'yesterday-ish'
      }),
        createImage({
          id: 'invalid-environment',

          meta: {
            environment: 'preview',
            kind: 'equipment-photo-submission'
          }
        }),
        createImage({
        id: 'other-kind',
        meta: { kind: 'equipment-item-image' }
      }),
        createImage({ id: 'unexpected' }),
        createImage({
        id: 'legacy-orphan',
        meta: { kind: 'equipment-photo-submission' }
      }),
        createImage({
        id: 'unsigned',
        requireSignedURLs: false
      })
      ],

      listComplete: true
    }

    const rejectedDeleteMock = vi.fn().mockResolvedValue(false)

    const deleteMocks = new Map([
      ['rejected', rejectedDeleteMock]
    ])

    const { binding, imageMock, listMock } = createImagesBinding({
      deleteMocks,
      pages: [page]
    })

    const references = createReferences({
      publishedImageIds: ['published'],

      submissionStatuses: [
        ['approved', 'approved'],
        ['pending', 'pending'],
        ['rejected', 'rejected'],
        ['unexpected', 'processing']
      ]
    })

    const lookupReferences = vi.fn<PhotoSubmissionImageReferenceLookup>()
      .mockResolvedValue(references)

    const summary = await cleanupPhotoSubmissionImages({
      environment: 'production',
      images: binding,
      lookupReferences,
      scheduledTime
    })

    expect(listMock).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 100,
      sortOrder: 'asc'
    })

    expect(lookupReferences).toHaveBeenCalledWith([
      'orphan',
      'rejected',
      'approved',
      'pending',
      'published',
      'unexpected',
      'legacy-orphan'
    ])

    expect(imageMock.mock.calls.map(([imageId]) => imageId)).toStrictEqual([
      'orphan',
      'rejected',
      'approved'
    ])

    expect(summary).toStrictEqual({
      alreadyMissing: 1,
      deleted: 2,
      failed: 0,
      keptForeignEnvironment: 1,
      keptLegacyUnscoped: 1,
      keptPending: 1,
      keptPublished: 1,
      keptTooNew: 1,
      keptUnexpectedStatus: 1,
      scanned: 13,
      skippedInvalid: 2,
      skippedIrrelevant: 2
    })
  })

  it('should follow Cloudflare Images cursors until the list is complete', async () => {
    const { binding, listMock } = createImagesBinding({
      pages: [
        {
          cursor: 'next-page',
          images: [],
          listComplete: false
        },
        {
          images: [],
          listComplete: true
        }
      ]
    })

    const lookupReferences = vi.fn<PhotoSubmissionImageReferenceLookup>()
      .mockResolvedValue(createReferences())

    await cleanupPhotoSubmissionImages({
      environment: 'staging',
      images: binding,
      lookupReferences,
      scheduledTime
    })

    expect(listMock).toHaveBeenNthCalledWith(1, {
      cursor: undefined,
      limit: 100,
      sortOrder: 'asc'
    })

    expect(listMock).toHaveBeenNthCalledWith(2, {
      cursor: 'next-page',
      limit: 100,
      sortOrder: 'asc'
    })
  })

  it('should fail without deleting when database classification fails', async () => {
    const { binding, imageMock } = createImagesBinding({
      pages: [{
        images: [createImage({ id: 'orphan' })],
        listComplete: true
      }]
    })

    const databaseError = new Error('database unavailable')

    const lookupReferences = vi.fn<PhotoSubmissionImageReferenceLookup>()
      .mockRejectedValue(databaseError)

    await expect(cleanupPhotoSubmissionImages({
      environment: 'production',
      images: binding,
      lookupReferences,
      scheduledTime
    })).rejects.toBe(databaseError)

    expect(imageMock).not.toHaveBeenCalled()
  })

  it('should report deletion failures and retry the same candidate on the next run', async () => {
    const deleteError = new Error('Cloudflare unavailable')

    const deleteMock = vi.fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(deleteError)
      .mockResolvedValueOnce(true)

    const listMock = vi.fn<PhotoSubmissionImagesBinding['hosted']['list']>()
      .mockResolvedValue({
        images: [createImage({ id: 'orphan' })],
        listComplete: true
      })

    const images = {
      hosted: {
        image: () => {
          return { delete: deleteMock }
        },

        list: listMock
      }
    } satisfies PhotoSubmissionImagesBinding

    const lookupReferences = vi.fn<PhotoSubmissionImageReferenceLookup>()
      .mockResolvedValue(createReferences())

    await expect(cleanupPhotoSubmissionImages({
      environment: 'production',
      images,
      lookupReferences,
      scheduledTime
    })).rejects.toMatchObject({
      errors: [{
        cause: deleteError,
        imageId: 'orphan'
      }],

      name: 'PhotoSubmissionImageCleanupError',
      summary: { failed: 1 }
    })

    const retrySummary = await cleanupPhotoSubmissionImages({
      environment: 'production',
      images,
      lookupReferences,
      scheduledTime
    })

    expect(retrySummary.deleted).toBe(1)
    expect(deleteMock).toHaveBeenCalledTimes(2)
  })
})
