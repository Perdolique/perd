import { createError, type H3Event } from 'h3'
import type { ApprovedPhotoSubmissionResponse } from '#server/utils/equipment/photo-submission-review'

interface HostedPhotoSubmissionImage {
  cloudflareImageId: string;
  handle: ReturnType<Env['IMAGES']['hosted']['image']>;
}

interface PhotoSubmissionPublicationCandidate {
  cloudflareImageId: string;
  createdBy: string | null;
  filename: string;
  item: { status: string; } | null;
  itemId: string;
  rightsConfirmed: boolean;
  status: string;
}

interface PreparedPhotoPublication {
  publicImage: HostedPhotoSubmissionImage;
  sourceImage: HostedPhotoSubmissionImage;
}

interface PublicationReconciliationResult {
  publicImageIsAttached: boolean;
  response: ApprovedPhotoSubmissionResponse | null;
}

interface ReconcilePublicationFailureOptions {
  error: unknown;
  event: H3Event;
  publication: PreparedPhotoPublication;
  submissionId: string;
}

function createTerminalStatusError() {
  return createError({
    status: 409,
    statusMessage: 'Photo submission is no longer pending'
  })
}

function createItemNotPublishedError() {
  return createError({
    status: 409,
    statusMessage: 'Equipment item is no longer published'
  })
}

function createRightsNotConfirmedError() {
  return createError({
    status: 409,
    statusMessage: 'Photo rights are not confirmed'
  })
}

async function deletePublishedSubmissionSourceImage(
  image: HostedPhotoSubmissionImage,
  submissionId: string
): Promise<void> {
  try {
    await image.handle.delete()
  } catch (error) {
    console.error('Failed to delete private Cloudflare photo submission image after publication', {
      cloudflareImageId: image.cloudflareImageId,
      error,
      submissionId
    })
  }
}

async function deleteUnattachedPublishedImage(
  image: HostedPhotoSubmissionImage,
  error: unknown,
  submissionId: string
): Promise<void> {
  try {
    await image.handle.delete()
  } catch (compensationError) {
    console.error('Failed to delete unattached public Cloudflare photo submission image', {
      cloudflareImageId: image.cloudflareImageId,
      compensationError,
      error,
      submissionId
    })
  }
}

async function findPublicationCandidate(
  event: H3Event,
  submissionId: string
): Promise<PhotoSubmissionPublicationCandidate> {
  const submission = await event.context.dbHttp.query.equipmentItemPhotoSubmissions.findFirst({
    columns: {
      cloudflareImageId: true,
      createdBy: true,
      filename: true,
      itemId: true,
      rightsConfirmed: true,
      status: true
    },

    where: {
      id: submissionId
    },

    with: {
      item: {
        columns: {
          status: true
        }
      }
    }
  })

  if (submission === undefined) {
    throw createError({ status: 404 })
  }

  if (submission.status !== 'pending') {
    throw createTerminalStatusError()
  }

  if (submission.item?.status !== 'approved') {
    throw createItemNotPublishedError()
  }

  if (submission.rightsConfirmed !== true) {
    throw createRightsNotConfirmedError()
  }

  return submission
}

async function preparePhotoPublication(
  event: H3Event,
  imagesBinding: Env['IMAGES'],
  submissionId: string
): Promise<PreparedPhotoPublication> {
  const submission = await findPublicationCandidate(event, submissionId)
  const sourceImageHandle = imagesBinding.hosted.image(submission.cloudflareImageId)

  try {
    const sourceImageBytes = await sourceImageHandle.bytes()

    if (sourceImageBytes === null) {
      throw new Error('Cloudflare photo submission image is missing')
    }

    const uploadOptions: ImageUploadOptions = {
      filename: submission.filename,

      metadata: {
        itemId: submission.itemId
      },

      requireSignedURLs: false
    }

    if (submission.createdBy !== null) {
      uploadOptions.creator = submission.createdBy
    }

    const uploadedImage = await imagesBinding.hosted.upload(sourceImageBytes, uploadOptions)

    return {
      publicImage: {
        cloudflareImageId: uploadedImage.id,
        handle: imagesBinding.hosted.image(uploadedImage.id)
      },

      sourceImage: {
        cloudflareImageId: submission.cloudflareImageId,
        handle: sourceImageHandle
      }
    }
  } catch (error) {
    console.error('Failed to publish Cloudflare photo submission image', {
      cloudflareImageId: submission.cloudflareImageId,
      error,
      submissionId
    })

    throw createError({
      status: 502,
      statusMessage: 'Photo publication failed'
    })
  }
}

async function findPublicationReconciliation(
  event: H3Event,
  publicCloudflareImageId: string,
  submissionId: string
): Promise<PublicationReconciliationResult> {
  const submissionPromise = event.context.dbHttp.query.equipmentItemPhotoSubmissions.findFirst({
    columns: {
      status: true
    },

    where: {
      id: submissionId
    }
  })

  const imagePromise = event.context.dbHttp.query.equipmentItemImages.findFirst({
    columns: {
      displayOrder: true,
      id: true
    },

    where: {
      cloudflareImageId: publicCloudflareImageId
    }
  })

  const [submission, image] = await Promise.all([
    submissionPromise,
    imagePromise
  ])

  const publicImageIsAttached = image !== undefined

  if (submission?.status !== 'approved' || image === undefined) {
    return {
      publicImageIsAttached,
      response: null
    }
  }

  return {
    publicImageIsAttached,

    response: {
      publishedImage: {
        displayOrder: image.displayOrder,
        id: image.id,
        isPrimary: image.displayOrder === 0
      },

      rejectionReason: null,
      status: 'approved'
    }
  }
}

async function findPublicationReconciliationSafely(
  options: ReconcilePublicationFailureOptions
): Promise<PublicationReconciliationResult> {
  const { error, event, publication, submissionId } = options

  try {
    return await findPublicationReconciliation(
      event,
      publication.publicImage.cloudflareImageId,
      submissionId
    )
  } catch (reconciliationError) {
    console.error('Failed to reconcile equipment photo publication', {
      cloudflareImageId: publication.publicImage.cloudflareImageId,
      error,
      reconciliationError,
      submissionId
    })

    throw createError({
      status: 500,
      statusMessage: 'Failed to review photo submission'
    })
  }
}

async function reconcilePublicationFailure(
  options: ReconcilePublicationFailureOptions
): Promise<ApprovedPhotoSubmissionResponse | null> {
  const { error, publication, submissionId } = options
  const reconciliation = await findPublicationReconciliationSafely(options)

  if (reconciliation.response !== null) {
    console.error('Reconciled equipment photo publication after transaction failure', {
      cloudflareImageId: publication.publicImage.cloudflareImageId,
      error,
      submissionId
    })

    return reconciliation.response
  }

  if (reconciliation.publicImageIsAttached) {
    console.error('Equipment photo publication reconciliation found inconsistent database state', {
      cloudflareImageId: publication.publicImage.cloudflareImageId,
      error,
      submissionId
    })

    throw createError({
      status: 500,
      statusMessage: 'Failed to review photo submission'
    })
  }

  await deleteUnattachedPublishedImage(publication.publicImage, error, submissionId)

  return null
}

export {
  createItemNotPublishedError,
  createRightsNotConfirmedError,
  createTerminalStatusError,
  deletePublishedSubmissionSourceImage,
  deleteUnattachedPublishedImage,
  preparePhotoPublication,
  reconcilePublicationFailure
}

export type { PreparedPhotoPublication }
