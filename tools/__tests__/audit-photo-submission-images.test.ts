import { describe, expect, it, vi } from 'vitest'
import { deleteCloudflareImages, listCloudflarePhotoSubmissionImages } from '../cloudflare-photo-submission-images'

import {
  createPhotoSubmissionImageAuditPlan,
  getAuditFingerprint,
  validateAuditFingerprint,
  type CloudflareAuditImage
} from '../photo-submission-image-audit'

import { parseAuditConfig } from '../photo-submission-image-audit-config'
import type { PhotoSubmissionImageReferences } from '#server/utils/equipment/photo-submission-image-references'

const now = Date.parse('2026-08-31T12:00:00.000Z')
const oldUploaded = '2026-08-29T12:00:00.000Z'

function createImage(overrides: Partial<CloudflareAuditImage> = {}): CloudflareAuditImage {
  return {
    id: 'image-1',
    meta: { kind: 'equipment-photo-submission' },
    requireSignedURLs: true,
    uploaded: oldUploaded,
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

function createListResponse(
  images: CloudflareAuditImage[],
  continuationToken?: string
): Response {
  return Response.json({
    errors: [],
    messages: [],

    result: {
      continuation_token: continuationToken,
      images
    },

    success: true
  })
}

function getFetchUrl(input: Parameters<typeof fetch>[0] | undefined): URL {
  if (input instanceof URL) {
    return input
  }

  throw new Error('Expected a URL fetch input')
}

describe('photo submission image audit', () => {
  it('should protect either database and select only old unscoped terminal or orphan images', () => {
    const images = [
      createImage({ id: 'orphan' }),
      createImage({ id: 'terminal' }),
      createImage({ id: 'pending' }),
      createImage({ id: 'published' }),
      createImage({ id: 'unexpected' }),
      createImage({
        id: 'scoped',

        meta: {
          environment: 'production',
          kind: 'equipment-photo-submission'
        }
      }),
      createImage({
        id: 'new',
        uploaded: '2026-08-31T11:00:00.000Z'
      }),
      createImage({
        id: 'unsigned',
        requireSignedURLs: false
      })
    ]

    const productionReferences = createReferences({
      publishedImageIds: ['published'],

      submissionStatuses: [
        ['terminal', 'rejected'],
        ['unexpected', 'processing']
      ]
    })

    const stagingReferences = createReferences({
      submissionStatuses: [
        ['pending', 'pending'],
        ['terminal', 'approved']
      ]
    })

    const plan = createPhotoSubmissionImageAuditPlan({
      accountId: 'account-1',
      images,
      now,
      productionReferences,
      stagingReferences
    })

    expect(plan).toStrictEqual({
      candidateIds: ['orphan', 'terminal'],
      cutoff: '2026-08-30T12:00:00.000Z',
      fingerprint: getAuditFingerprint('account-1', ['orphan', 'terminal']),

      summary: {
        candidates: 2,
        keptPending: 1,
        keptPublished: 1,
        keptScoped: 1,
        keptTooNew: 1,
        keptUnexpectedStatus: 1,
        orphanCandidates: 1,
        scanned: 8,
        skippedInvalid: 1,
        terminalCandidates: 1
      }
    })
  })

  it('should list every filtered Cloudflare page with the continuation token', async () => {
    const firstImage = createImage({ id: 'first' })
    const secondImage = createImage({ id: 'second' })

    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(createListResponse([firstImage], 'next-token'))
      .mockResolvedValueOnce(createListResponse([secondImage]))

    const images = await listCloudflarePhotoSubmissionImages({
      accountId: 'account-1',
      apiToken: 'token-1',
      fetchImplementation: fetchMock
    })

    expect(images).toStrictEqual([firstImage, secondImage])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstUrl = getFetchUrl(fetchMock.mock.calls[0]?.[0])
    const secondUrl = getFetchUrl(fetchMock.mock.calls[1]?.[0])

    expect(firstUrl.searchParams.get('meta.kind[eq:string]'))
      .toBe('equipment-photo-submission')

    expect(firstUrl.searchParams.get('per_page')).toBe('1000')
    expect(firstUrl.searchParams.get('sort_order')).toBe('asc')
    expect(firstUrl.searchParams.has('continuation_token')).toBe(false)
    expect(secondUrl.searchParams.get('continuation_token')).toBe('next-token')

    expect(fetchMock.mock.calls[0]?.[1]).toStrictEqual({
      headers: {
        Authorization: 'Bearer token-1'
      }
    })
  })

  it('should count deleted and already missing Cloudflare images', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        result: {},
        success: true
      }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    const summary = await deleteCloudflareImages({
      accountId: 'account-1',
      apiToken: 'token-1',
      fetchImplementation: fetchMock,
      imageIds: ['deleted', 'missing']
    })

    expect(summary).toStrictEqual({
      alreadyMissing: 1,
      deleted: 1,
      failed: 0
    })

    expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toStrictEqual([
      'DELETE',
      'DELETE'
    ])
  })

  it('should preserve failed deletions for a later retry', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValue(Response.json(
        {
          errors: [{ message: 'unavailable' }],
          success: false
        },
        { status: 503 }
      ))

    await expect(deleteCloudflareImages({
      accountId: 'account-1',
      apiToken: 'token-1',
      fetchImplementation: fetchMock,
      imageIds: ['failed']
    })).rejects.toMatchObject({
      name: 'CloudflareImageAuditDeletionError',

      summary: {
        alreadyMissing: 0,
        deleted: 0,
        failed: 1
      }
    })
  })

  it('should require the exact reviewed fingerprint before apply', () => {
    const plan = createPhotoSubmissionImageAuditPlan({
      accountId: 'account-1',
      images: [createImage({ id: 'orphan' })],
      now,
      productionReferences: createReferences(),
      stagingReferences: createReferences()
    })

    expect(() => {
      validateAuditFingerprint(plan.fingerprint, plan)
    }).not.toThrow()

    expect(() => {
      validateAuditFingerprint('old-fingerprint', plan)
    })
      .toThrow(`received ${plan.fingerprint}`)
  })

  it('should parse secrets from the environment without putting them in arguments', () => {
    const config = parseAuditConfig(['--apply', 'fingerprint-1'], {
      CLOUDFLARE_ACCOUNT_ID: 'account-1',
      CLOUDFLARE_API_TOKEN: 'token-1',
      PERD_PRODUCTION_DATABASE_URL: 'postgresql://production.example/perd',
      PERD_STAGING_DATABASE_URL: 'postgresql://staging.example/perd'
    })

    expect(config).toStrictEqual({
      accountId: 'account-1',
      apiToken: 'token-1',
      applyFingerprint: 'fingerprint-1',
      productionDatabaseUrl: 'postgresql://production.example/perd',
      stagingDatabaseUrl: 'postgresql://staging.example/perd'
    })
  })
})
