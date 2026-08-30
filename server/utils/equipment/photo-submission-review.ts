import { and, eq, gt, max, sql } from 'drizzle-orm'
import { createError } from 'h3'

import {
  contributions,
  equipmentItemImages,
  equipmentItemPhotoSubmissions,
  equipmentItems
} from '#server/database/schema'

import type { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  createItemNotPublishedError,
  createRightsNotConfirmedError,
  createTerminalStatusError,
  type PreparedPhotoPublication
} from '#server/utils/equipment/photo-submission-publication'

import type { validatePhotoSubmissionDecisionBody } from '#server/utils/validation/schemas'

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
type PhotoSubmissionDecision = ReturnType<typeof validatePhotoSubmissionDecisionBody>
type PhotoSubmissionReviewDatabase = ReturnType<typeof createWebSocketClientFromEvent>

interface ExecutePhotoSubmissionDecisionOptions {
  body: PhotoSubmissionDecision;
  database: PhotoSubmissionReviewDatabase;
  publication: PreparedPhotoPublication | null;
  submissionId: string;
  userId: string;
}

async function executePhotoSubmissionDecision(
  options: ExecutePhotoSubmissionDecisionOptions
): Promise<PhotoSubmissionDecisionResponse> {
  const { body, database, publication, submissionId, userId } = options

  return database.transaction(async (transaction): Promise<PhotoSubmissionDecisionResponse> => {
    const [submission] = await transaction
      .select({
        cloudflareImageId: equipmentItemPhotoSubmissions.cloudflareImageId,
        itemId: equipmentItemPhotoSubmissions.itemId,
        rightsConfirmed: equipmentItemPhotoSubmissions.rightsConfirmed,
        status: equipmentItemPhotoSubmissions.status
      })
      .from(equipmentItemPhotoSubmissions)
      .where(eq(equipmentItemPhotoSubmissions.id, submissionId))
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
        .where(eq(equipmentItemPhotoSubmissions.id, submissionId))

      await transaction
        .insert(contributions)
        .values({
          action: 'reject_item_photo_submission',

          metadata: {
            itemId: submission.itemId,
            rejectionReason: body.rejectionReason,
            status: 'rejected'
          },

          targetId: submissionId,
          userId
        })

      return {
        publishedImage: null,
        rejectionReason: body.rejectionReason,
        status: 'rejected'
      }
    }

    if (publication === null) {
      throw new Error('Photo publication was not prepared')
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
      throw createItemNotPublishedError()
    }

    if (submission.rightsConfirmed !== true) {
      throw createRightsNotConfirmedError()
    }

    if (submission.cloudflareImageId !== publication.sourceImage.cloudflareImageId) {
      throw createTerminalStatusError()
    }

    const maximumDisplayOrder = max(equipmentItemImages.displayOrder)

    const [displayOrderRow] = await transaction
      .select({ displayOrder: maximumDisplayOrder })
      .from(equipmentItemImages)
      .where(eq(equipmentItemImages.itemId, submission.itemId))

    const previousDisplayOrder = displayOrderRow?.displayOrder ?? -1
    const displayOrder = body.makePrimary ? 0 : previousDisplayOrder + 1

    if (body.makePrimary && previousDisplayOrder >= 0) {
      const temporaryOffset = previousDisplayOrder + 2

      // Move positions beyond the current range before compacting to avoid the unique order constraint.
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
        cloudflareImageId: publication.publicImage.cloudflareImageId,
        displayOrder,
        itemId: submission.itemId
      })
      .returning({
        displayOrder: equipmentItemImages.displayOrder,
        id: equipmentItemImages.id
      })

    if (publishedImage === undefined) {
      throw new Error(`Photo submission ${submissionId} image insert returned no row`)
    }

    await transaction
      .update(equipmentItemPhotoSubmissions)
      .set({
        rejectionReason: null,
        status: 'approved'
      })
      .where(eq(equipmentItemPhotoSubmissions.id, submissionId))

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

        targetId: submissionId,
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
}

export { executePhotoSubmissionDecision }

export type {
  ApprovedPhotoSubmissionResponse,
  PhotoSubmissionDecisionResponse,
  PhotoSubmissionReviewDatabase,
  PublishedPhotoSubmissionImage,
  RejectedPhotoSubmissionResponse
}
