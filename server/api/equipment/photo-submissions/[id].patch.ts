import { and, eq, gt, max, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getValidatedRouterParams, isError, readValidatedBody } from 'h3'

import {
  contributions,
  equipmentItemImages,
  equipmentItemPhotoSubmissions,
  equipmentItems
} from '#server/database/schema'

import { validateAdminUser } from '#server/utils/admin'
import { getCloudflareImagesBinding } from '#server/utils/cloudflare'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { validatePhotoSubmissionDecisionBody, validatePhotoSubmissionParams } from '#server/utils/validation/schemas'

interface PublishedPhotoSubmissionImage {
  displayOrder: number;
  id: string;
  isPrimary: boolean;
}

interface ApprovedPhotoSubmissionResponse {
  publishedImage: PublishedPhotoSubmissionImage;
  rejectionReason: null;
  status: 'approved';
}

interface RejectedPhotoSubmissionResponse {
  publishedImage: null;
  rejectionReason: string;
  status: 'rejected';
}

type PhotoSubmissionDecisionResponse = ApprovedPhotoSubmissionResponse | RejectedPhotoSubmissionResponse

interface HostedPhotoSubmissionImage {
  cloudflareImageId: string;
  handle: ReturnType<Env['IMAGES']['hosted']['image']>;
}

function createTerminalStatusError() {
  return createError({
    status: 409,
    statusMessage: 'Photo submission is no longer pending'
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

export default defineEventHandler(async (event): Promise<PhotoSubmissionDecisionResponse> => {
  const userId = await validateAdminUser(event)
  const { id } = await getValidatedRouterParams(event, validatePhotoSubmissionParams)
  const body = await readValidatedBody(event, validatePhotoSubmissionDecisionBody)

  const imagesBinding = body.decision === 'publish'
    ? getCloudflareImagesBinding(event)
    : null

  const dbWebsocket = createWebSocketClientFromEvent(event)

  const publicationState: {
    publishedImage: HostedPhotoSubmissionImage | null;
    sourceImage: HostedPhotoSubmissionImage | null;
  } = {
    publishedImage: null,
    sourceImage: null
  }

  try {
    const response = await dbWebsocket.transaction(async (
      transaction
    ): Promise<PhotoSubmissionDecisionResponse> => {
      const [submission] = await transaction
        .select({
          cloudflareImageId: equipmentItemPhotoSubmissions.cloudflareImageId,
          createdBy: equipmentItemPhotoSubmissions.createdBy,
          filename: equipmentItemPhotoSubmissions.filename,
          itemId: equipmentItemPhotoSubmissions.itemId,
          rightsConfirmed: equipmentItemPhotoSubmissions.rightsConfirmed,
          status: equipmentItemPhotoSubmissions.status
        })
        .from(equipmentItemPhotoSubmissions)
        .where(eq(equipmentItemPhotoSubmissions.id, id))
        .limit(1)
        .for('update')

      if (submission === undefined) {
        throw createError({ status: 404 })
      }

      if (submission.status !== 'pending') {
        throw createTerminalStatusError()
      }

      if (body.decision === 'reject') {
        await transaction
          .update(equipmentItemPhotoSubmissions)
          .set({
            rejectionReason: body.rejectionReason,
            status: 'rejected'
          })
          .where(eq(equipmentItemPhotoSubmissions.id, id))

        await transaction
          .insert(contributions)
          .values({
            action: 'reject_item_photo_submission',

            metadata: {
              itemId: submission.itemId,
              rejectionReason: body.rejectionReason,
              status: 'rejected'
            },

            targetId: id,
            userId
          })

        return {
          publishedImage: null,
          rejectionReason: body.rejectionReason,
          status: 'rejected'
        }
      }

      const [item] = await transaction
        .select({
          id: equipmentItems.id,
          status: equipmentItems.status
        })
        .from(equipmentItems)
        .where(eq(equipmentItems.id, submission.itemId))
        .limit(1)
        .for('update')

      if (item?.status !== 'approved') {
        throw createError({
          status: 409,
          statusMessage: 'Equipment item is no longer published'
        })
      }

      if (submission.rightsConfirmed !== true) {
        throw createError({
          status: 409,
          statusMessage: 'Photo rights are not confirmed'
        })
      }

      if (imagesBinding === null) {
        throw new Error('Images binding was not initialized for publication')
      }

      const maximumDisplayOrder = max(equipmentItemImages.displayOrder)

      const [displayOrderRow] = await transaction
        .select({ displayOrder: maximumDisplayOrder })
        .from(equipmentItemImages)
        .where(eq(equipmentItemImages.itemId, submission.itemId))

      const previousDisplayOrder = displayOrderRow?.displayOrder ?? -1
      const displayOrder = body.makePrimary ? 0 : previousDisplayOrder + 1
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
        const publishedImageHandle = imagesBinding.hosted.image(uploadedImage.id)

        publicationState.publishedImage = {
          cloudflareImageId: uploadedImage.id,
          handle: publishedImageHandle
        }

        publicationState.sourceImage = {
          cloudflareImageId: submission.cloudflareImageId,
          handle: sourceImageHandle
        }
      } catch (error) {
        console.error('Failed to publish Cloudflare photo submission image', {
          cloudflareImageId: submission.cloudflareImageId,
          error,
          submissionId: id
        })

        throw createError({
          status: 502,
          statusMessage: 'Photo publication failed'
        })
      }

      const { publishedImage: publishedHostedImage } = publicationState

      if (body.makePrimary && previousDisplayOrder >= 0) {
        const temporaryOffset = previousDisplayOrder + 2

        await transaction
          .update(equipmentItemImages)
          .set({
            displayOrder: sql`${equipmentItemImages.displayOrder} + ${temporaryOffset}`
          })
          .where(eq(equipmentItemImages.itemId, submission.itemId))

        await transaction
          .update(equipmentItemImages)
          .set({
            displayOrder: sql`${equipmentItemImages.displayOrder} - ${temporaryOffset} + 1`
          })
          .where(and(
            eq(equipmentItemImages.itemId, submission.itemId),
            gt(equipmentItemImages.displayOrder, previousDisplayOrder)
          ))
      }

      const [publishedImage] = await transaction
        .insert(equipmentItemImages)
        .values({
          cloudflareImageId: publishedHostedImage.cloudflareImageId,
          displayOrder,
          itemId: submission.itemId
        })
        .returning({
          displayOrder: equipmentItemImages.displayOrder,
          id: equipmentItemImages.id
        })

      if (publishedImage === undefined) {
        throw new Error(`Photo submission ${id} image insert returned no row`)
      }

      await transaction
        .update(equipmentItemPhotoSubmissions)
        .set({
          rejectionReason: null,
          status: 'approved'
        })
        .where(eq(equipmentItemPhotoSubmissions.id, id))

      await transaction
        .insert(contributions)
        .values({
          action: 'publish_item_photo_submission',

          metadata: {
            displayOrder: publishedImage.displayOrder,
            imageId: publishedImage.id,
            itemId: submission.itemId,
            makePrimary: body.makePrimary,
            status: 'approved'
          },

          targetId: id,
          userId
        })

      return {
        publishedImage: {
          displayOrder: publishedImage.displayOrder,
          id: publishedImage.id,
          isPrimary: publishedImage.displayOrder === 0
        },

        rejectionReason: null,
        status: 'approved'
      }
    })

    const { sourceImage } = publicationState

    if (sourceImage !== null) {
      event.waitUntil(deletePublishedSubmissionSourceImage(sourceImage, id))
    }

    return response
  } catch (error) {
    const { publishedImage } = publicationState

    if (publishedImage !== null) {
      try {
        await publishedImage.handle.delete()
      } catch (compensationError) {
        console.error('Failed to delete unattached public Cloudflare photo submission image', {
          cloudflareImageId: publishedImage.cloudflareImageId,
          compensationError,
          error,
          submissionId: id
        })
      }
    }

    if (isError(error)) {
      throw error
    }

    console.error('Failed to review equipment photo submission', {
      error,
      submissionId: id
    })

    throw createError({
      status: 500,
      statusMessage: 'Failed to review photo submission'
    })
  } finally {
    await dbWebsocket.$client.end()
  }
})

export type {
  ApprovedPhotoSubmissionResponse,
  PhotoSubmissionDecisionResponse,
  PublishedPhotoSubmissionImage,
  RejectedPhotoSubmissionResponse
}
