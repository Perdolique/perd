import * as v from 'valibot'
import type { CloudflareAuditImage } from './photo-submission-image-audit'
import { photoSubmissionImageKind } from '#server/utils/equipment/photo-submission-image-metadata'

const cloudflareApiBaseUrl = 'https://api.cloudflare.com/client/v4'
const cloudflareListPageSize = 1000
const cloudflareDeleteBatchSize = 10

const cloudflareImageSchema = v.object({
  id: v.string(),
  meta: v.optional(v.unknown()),
  requireSignedURLs: v.optional(v.boolean()),
  uploaded: v.optional(v.string())
})

const cloudflareListResponseSchema = v.object({
  result: v.object({
    continuation_token: v.optional(v.string()),
    images: v.optional(v.array(cloudflareImageSchema))
  }),

  success: v.literal(true)
})

const cloudflareDeleteResponseSchema = v.object({
  success: v.literal(true)
})

type AuditFetch = typeof fetch

interface ListCloudflareImagesOptions {
  accountId: string;
  apiToken: string;
  fetchImplementation: AuditFetch;
}

interface DeleteCloudflareImagesOptions extends ListCloudflareImagesOptions {
  imageIds: string[];
}

interface CloudflareImageDeleteSummary {
  alreadyMissing: number;
  deleted: number;
  failed: number;
}

interface CloudflareImagePaginationState {
  complete: boolean;
  continuationToken: string | null;
}

class CloudflareImageAuditDeletionError extends AggregateError {
  readonly summary: CloudflareImageDeleteSummary

  constructor(errors: unknown[], summary: CloudflareImageDeleteSummary) {
    super(errors, `Failed to delete ${summary.failed} audited Cloudflare image(s)`)
    this.name = 'CloudflareImageAuditDeletionError'
    this.summary = summary
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    throw new Error(`Cloudflare API returned invalid JSON with status ${response.status}`, {
      cause: error
    })
  }
}

async function listCloudflarePhotoSubmissionImages(
  options: ListCloudflareImagesOptions
): Promise<CloudflareAuditImage[]> {
  const images: CloudflareAuditImage[] = []

  let paginationState: CloudflareImagePaginationState = {
    complete: false,
    continuationToken: null
  }

  while (!paginationState.complete) {
    const { continuationToken } = paginationState

    const url = new URL(
      `${cloudflareApiBaseUrl}/accounts/${encodeURIComponent(options.accountId)}/images/v2`
    )

    url.searchParams.set('meta.kind[eq:string]', photoSubmissionImageKind)
    url.searchParams.set('per_page', String(cloudflareListPageSize))
    url.searchParams.set('sort_order', 'asc')

    if (continuationToken !== null) {
      url.searchParams.set('continuation_token', continuationToken)
    }

    // oxlint-disable-next-line no-await-in-loop -- Each REST page provides the next continuation token.
    const response = await options.fetchImplementation(url, {
      headers: {
        Authorization: `Bearer ${options.apiToken}`
      }
    })

    // oxlint-disable-next-line no-await-in-loop -- The bounded page must be validated before pagination continues.
    const data = await readJson(response)

    if (!response.ok) {
      throw new Error(`Cloudflare Images list failed with status ${response.status}`)
    }

    const parsed = v.parse(cloudflareListResponseSchema, data)
    const pageImages = parsed.result.images ?? []
    const nextContinuationToken = parsed.result.continuation_token

    images.push(...pageImages)

    if (
      nextContinuationToken !== undefined
      && nextContinuationToken === continuationToken
    ) {
      throw new Error('Cloudflare Images list returned the same continuation token')
    }

    paginationState = {
      complete: nextContinuationToken === undefined,
      continuationToken: nextContinuationToken ?? null
    }
  }

  return images
}

function chunkValues<Value>(values: Value[], size: number): Value[][] {
  const chunks: Value[][] = []

  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size))
  }

  return chunks
}

async function deleteCloudflareImage(
  imageId: string,
  options: ListCloudflareImagesOptions
): Promise<'already-missing' | 'deleted'> {
  const imagePath = encodeURIComponent(imageId)
  const accountPath = encodeURIComponent(options.accountId)
  const url = `${cloudflareApiBaseUrl}/accounts/${accountPath}/images/v1/${imagePath}`

  const response = await options.fetchImplementation(url, {
    headers: {
      Authorization: `Bearer ${options.apiToken}`
    },

    method: 'DELETE'
  })

  if (response.status === 404) {
    return 'already-missing'
  }

  const data = await readJson(response)

  if (!response.ok) {
    throw new Error(`Cloudflare image ${imageId} deletion failed with status ${response.status}`)
  }

  v.parse(cloudflareDeleteResponseSchema, data)

  return 'deleted'
}

async function deleteCloudflareImages(
  options: DeleteCloudflareImagesOptions
): Promise<CloudflareImageDeleteSummary> {
  const summary: CloudflareImageDeleteSummary = {
    alreadyMissing: 0,
    deleted: 0,
    failed: 0
  }

  const errors: unknown[] = []
  const batches = chunkValues(options.imageIds, cloudflareDeleteBatchSize)

  for (const batch of batches) {
    // oxlint-disable-next-line no-await-in-loop -- Sequential batches cap destructive API concurrency at ten.
    const results = await Promise.allSettled(
      batch.map(async (imageId) => {
        try {
          return await deleteCloudflareImage(imageId, options)
        } catch (error) {
          throw Object.assign(
            new Error(`Failed to delete audited Cloudflare image ${imageId}`, {
              cause: error
            }),
            { imageId }
          )
        }
      })
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        summary.failed += 1
        errors.push(result.reason)
      } else if (result.value === 'already-missing') {
        summary.alreadyMissing += 1
      } else {
        summary.deleted += 1
      }
    }
  }

  if (errors.length > 0) {
    throw new CloudflareImageAuditDeletionError(errors, summary)
  }

  return summary
}

export {
  deleteCloudflareImages,
  listCloudflarePhotoSubmissionImages,
  CloudflareImageAuditDeletionError
}

export type {
  CloudflareImageDeleteSummary
}
