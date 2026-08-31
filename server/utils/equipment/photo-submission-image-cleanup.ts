import type {
  PhotoSubmissionImageReferenceLookup,
  PhotoSubmissionImageReferences
} from '#server/utils/equipment/photo-submission-image-references'

import {
  photoSubmissionImageKind,
  photoSubmissionImageRetentionMilliseconds,
  safeParsePhotoSubmissionEnvironment,
  type PhotoSubmissionEnvironment
} from '#server/utils/equipment/photo-submission-image-metadata'

const photoSubmissionImageListPageSize = 100

interface PhotoSubmissionImagesBinding {
  hosted: {
    image: (imageId: string) => Pick<ImageHandle, 'delete'>;
    list: (options?: ImageListOptions) => Promise<ImageList>;
  };
}

interface PhotoSubmissionImageCleanupOptions {
  environment: PhotoSubmissionEnvironment;
  images: PhotoSubmissionImagesBinding;
  lookupReferences: PhotoSubmissionImageReferenceLookup;
  scheduledTime: number;
}

interface PhotoSubmissionImageCleanupSummary {
  alreadyMissing: number;
  deleted: number;
  failed: number;
  keptForeignEnvironment: number;
  keptLegacyUnscoped: number;
  keptPending: number;
  keptPublished: number;
  keptTooNew: number;
  keptUnexpectedStatus: number;
  scanned: number;
  skippedInvalid: number;
  skippedIrrelevant: number;
}

interface PreliminaryCandidate {
  environment: PhotoSubmissionEnvironment | null;
  id: string;
}

interface PreliminaryCandidateOptions {
  cutoff: number;
  environment: PhotoSubmissionEnvironment;
  image: ImageMetadata;
  summary: PhotoSubmissionImageCleanupSummary;
}

interface ProcessImagePageOptions {
  cleanupOptions: PhotoSubmissionImageCleanupOptions;
  cutoff: number;
  page: ImageList;
  summary: PhotoSubmissionImageCleanupSummary;
}

class PhotoSubmissionImageCleanupError extends AggregateError {
  readonly summary: PhotoSubmissionImageCleanupSummary

  constructor(errors: unknown[], summary: PhotoSubmissionImageCleanupSummary) {
    super(errors, `Failed to delete ${summary.failed} photo submission image(s)`)
    this.name = 'PhotoSubmissionImageCleanupError'
    this.summary = summary
  }
}

function createCleanupSummary(): PhotoSubmissionImageCleanupSummary {
  return {
    alreadyMissing: 0,
    deleted: 0,
    failed: 0,
    keptForeignEnvironment: 0,
    keptLegacyUnscoped: 0,
    keptPending: 0,
    keptPublished: 0,
    keptTooNew: 0,
    keptUnexpectedStatus: 0,
    scanned: 0,
    skippedInvalid: 0,
    skippedIrrelevant: 0
  }
}

function getPreliminaryCandidate(
  options: PreliminaryCandidateOptions
): PreliminaryCandidate | null {
  const {
    cutoff,
    environment,
    image,
    summary
  } = options

  if (
    image.requireSignedURLs !== true
    || image.meta?.kind !== photoSubmissionImageKind
  ) {
    summary.skippedIrrelevant += 1

    return null
  }

  if (image.uploaded === undefined) {
    summary.skippedInvalid += 1

    return null
  }

  const uploadedTime = Date.parse(image.uploaded)

  if (Number.isNaN(uploadedTime)) {
    summary.skippedInvalid += 1

    return null
  }

  if (uploadedTime > cutoff) {
    summary.keptTooNew += 1

    return null
  }

  const environmentValue = image.meta.environment

  if (environmentValue === undefined) {
    return {
      environment: null,
      id: image.id
    }
  }

  const imageEnvironment = safeParsePhotoSubmissionEnvironment(environmentValue)

  if (imageEnvironment === null) {
    summary.skippedInvalid += 1

    return null
  }

  if (imageEnvironment !== environment) {
    summary.keptForeignEnvironment += 1

    return null
  }

  return {
    environment: imageEnvironment,
    id: image.id
  }
}

function selectDeletionCandidateIds(
  candidates: PreliminaryCandidate[],
  references: PhotoSubmissionImageReferences,
  summary: PhotoSubmissionImageCleanupSummary
): string[] {
  const deletionCandidateIds: string[] = []

  for (const candidate of candidates) {
    let shouldDelete = false

    if (references.publishedImageIds.has(candidate.id)) {
      summary.keptPublished += 1
    } else {
      const submissionStatus = references.submissionStatuses.get(candidate.id)

      if (submissionStatus === 'pending') {
        summary.keptPending += 1
      } else if (submissionStatus === 'approved' || submissionStatus === 'rejected') {
        shouldDelete = true
      } else if (submissionStatus !== undefined) {
        summary.keptUnexpectedStatus += 1
      } else if (candidate.environment === null) {
        summary.keptLegacyUnscoped += 1
      } else {
        shouldDelete = true
      }
    }

    if (shouldDelete) {
      deletionCandidateIds.push(candidate.id)
    }
  }

  return deletionCandidateIds
}

async function deleteCandidates(
  candidateIds: string[],
  images: PhotoSubmissionImagesBinding,
  summary: PhotoSubmissionImageCleanupSummary
): Promise<unknown[]> {
  const deletionPromises = candidateIds.map(async (imageId) => {
    try {
      const deleted = await images.hosted.image(imageId).delete()

      return { deleted }
    } catch (error) {
      throw Object.assign(
        new Error(`Failed to delete photo submission image ${imageId}`, {
          cause: error
        }),
        { imageId }
      )
    }
  })

  const results = await Promise.allSettled(deletionPromises)
  const errors: unknown[] = []

  for (const result of results) {
    if (result.status === 'rejected') {
      summary.failed += 1
      errors.push(result.reason)
    } else if (result.value.deleted) {
      summary.deleted += 1
    } else {
      summary.alreadyMissing += 1
    }
  }

  return errors
}

async function processImagePage(
  options: ProcessImagePageOptions
): Promise<unknown[]> {
  const {
    cleanupOptions,
    cutoff,
    page,
    summary
  } = options

  summary.scanned += page.images.length

  const preliminaryCandidates = page.images.flatMap((image) => {
    const candidate = getPreliminaryCandidate({
      cutoff,
      environment: cleanupOptions.environment,
      image,
      summary
    })

    return candidate === null ? [] : [candidate]
  })

  const cloudflareImageIds = preliminaryCandidates.map((candidate) => candidate.id)
  const references = await cleanupOptions.lookupReferences(cloudflareImageIds)

  const deletionCandidateIds = selectDeletionCandidateIds(
    preliminaryCandidates,
    references,
    summary
  )

  return deleteCandidates(deletionCandidateIds, cleanupOptions.images, summary)
}

/** Removes expired private contribution images without mutating review history. */
async function cleanupPhotoSubmissionImages(
  options: PhotoSubmissionImageCleanupOptions
): Promise<PhotoSubmissionImageCleanupSummary> {
  const cutoff = options.scheduledTime - photoSubmissionImageRetentionMilliseconds
  const summary = createCleanupSummary()
  const errors: unknown[] = []
  let cursor: false | string | null = null

  while (cursor !== false) {
    const requestCursor = cursor

    // oxlint-disable-next-line no-await-in-loop -- Each Cloudflare page provides the next cursor.
    const page = await options.images.hosted.list({
      cursor: requestCursor ?? undefined,
      limit: photoSubmissionImageListPageSize,
      sortOrder: 'asc'
    })

    // oxlint-disable-next-line no-await-in-loop -- Every page is classified before its bounded deletion batch.
    const pageErrors = await processImagePage({
      cleanupOptions: options,
      cutoff,
      page,
      summary
    })

    errors.push(...pageErrors)

    const {
      cursor: nextCursor,
      listComplete: pageListComplete
    } = page

    if (!pageListComplete && (nextCursor === undefined || nextCursor === requestCursor)) {
      throw new Error('Cloudflare Images pagination returned no new cursor')
    }

    cursor = pageListComplete ? false : nextCursor ?? false
  }

  if (errors.length > 0) {
    throw new PhotoSubmissionImageCleanupError(errors, summary)
  }

  return summary
}

export {
  cleanupPhotoSubmissionImages,
  PhotoSubmissionImageCleanupError
}

export type {
  PhotoSubmissionImageCleanupOptions,
  PhotoSubmissionImageCleanupSummary,
  PhotoSubmissionImagesBinding
}
