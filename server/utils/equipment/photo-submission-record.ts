import { createError } from 'h3'

const maximumPendingPhotoSubmissionCount = 3

interface PersistedPhotoSubmission {
  cloudflareImageId: string;
  id: string;
  itemId: string;
  status: 'pending';
}

interface PersistedPhotoSubmissionRow {
  cloudflareImageId: string;
  id: string;
  itemId: string;
  status: string;
}

function createPendingPhotoSubmissionLimitError() {
  return createError({
    status: 409,
    statusMessage: 'Three photos are already awaiting review for this item'
  })
}

function mapPersistedPhotoSubmission(
  submission: PersistedPhotoSubmissionRow | undefined
): PersistedPhotoSubmission | null {
  if (submission === undefined) {
    return null
  }

  if (submission.status !== 'pending') {
    throw new Error(`Unexpected photo submission status: ${submission.status}`)
  }

  return {
    cloudflareImageId: submission.cloudflareImageId,
    id: submission.id,
    itemId: submission.itemId,
    status: submission.status
  }
}

function validatePhotoSubmissionIdempotencyItem(
  submission: PersistedPhotoSubmission,
  itemId: string
): void {
  if (submission.itemId !== itemId) {
    throw createError({
      status: 409,
      statusMessage: 'Idempotency key has already been used'
    })
  }
}

export {
  createPendingPhotoSubmissionLimitError,
  mapPersistedPhotoSubmission,
  maximumPendingPhotoSubmissionCount,
  validatePhotoSubmissionIdempotencyItem
}

export type {
  PersistedPhotoSubmission
}
