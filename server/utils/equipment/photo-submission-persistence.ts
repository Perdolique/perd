import { and, eq } from 'drizzle-orm'
import { createError, isError, type H3Event } from 'h3'
import { contributions, equipmentItemPhotoSubmissions, equipmentItems } from '#server/database/schema'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { deleteUnattachedHostedEquipmentImage } from '#server/utils/equipment/item-images'

import {
  createPendingPhotoSubmissionLimitError,
  mapPersistedPhotoSubmission,
  maximumPendingPhotoSubmissionCount,
  validatePhotoSubmissionIdempotencyItem,
  type PersistedPhotoSubmission
} from '#server/utils/equipment/photo-submission-record'

interface PhotoSubmissionTransactionResult {
  isCreated: boolean;
  submission: PersistedPhotoSubmission;
}

interface PersistUploadedPhotoSubmissionOptions {
  binding: Env['IMAGES'];
  cloudflareImageId: string;
  event: H3Event;
  filename: string;
  idempotencyKey: string;
  itemId: string;
  sourceType: 'manufacturer' | 'own';
  sourceUrl?: string;
  userId: string;
}

async function findPersistedPhotoSubmission(
  event: H3Event,
  userId: string,
  idempotencyKey: string
): Promise<PersistedPhotoSubmission | null> {
  const submission = await event.context.dbHttp.query.equipmentItemPhotoSubmissions.findFirst({
    columns: {
      cloudflareImageId: true,
      id: true,
      itemId: true,
      status: true
    },

    where: {
      createdBy: userId,
      idempotencyKey
    }
  })

  return mapPersistedPhotoSubmission(submission)
}

async function closePhotoSubmissionDatabase(
  database: ReturnType<typeof createWebSocketClientFromEvent> | null,
  itemId: string
): Promise<void> {
  if (database === null) {
    return
  }

  try {
    await database.$client.end()
  } catch (error) {
    console.error('Failed to close photo submission database client', {
      error,
      itemId
    })
  }
}

function throwPhotoSubmissionPersistenceError(
  error: unknown,
  cloudflareImageId: string,
  itemId: string
): never {
  if (isError(error)) {
    throw error
  }

  console.error('Failed to save equipment photo submission', {
    cloudflareImageId,
    error,
    itemId
  })

  throw createError({
    status: 500,
    statusMessage: 'Failed to save photo submission'
  })
}

async function findReconciledPhotoSubmission(options: {
  event: H3Event;
  idempotencyKey: string;
  userId: string;
}): Promise<{
  error: unknown;
  submission: PersistedPhotoSubmission | null;
}> {
  const { event, idempotencyKey, userId } = options

  try {
    return {
      error: null,
      submission: await findPersistedPhotoSubmission(event, userId, idempotencyKey)
    }
  } catch (error) {
    return {
      error,
      submission: null
    }
  }
}

async function reconcilePhotoSubmissionFailure(
  options: PersistUploadedPhotoSubmissionOptions,
  error: unknown
): Promise<PersistedPhotoSubmission> {
  const { binding, cloudflareImageId, event, idempotencyKey, itemId, userId } = options

  const reconciliation = await findReconciledPhotoSubmission({
    event,
    idempotencyKey,
    userId
  })

  if (reconciliation.error !== null) {
    console.error('Failed to reconcile equipment photo submission', {
      cloudflareImageId,
      error,
      idempotencyKey,
      itemId,
      reconciliationError: reconciliation.error,
      userId
    })

    throw createError({
      status: 500,
      statusMessage: 'Failed to save photo submission'
    })
  }

  if (reconciliation.submission === null) {
    await deleteUnattachedHostedEquipmentImage({
      binding,
      cloudflareImageId
    })
    throwPhotoSubmissionPersistenceError(error, cloudflareImageId, itemId)
  }

  const persistedSubmission = reconciliation.submission

  if (persistedSubmission.cloudflareImageId !== cloudflareImageId) {
    await deleteUnattachedHostedEquipmentImage({
      binding,
      cloudflareImageId
    })
  }

  validatePhotoSubmissionIdempotencyItem(persistedSubmission, itemId)

  return persistedSubmission
}

async function executePhotoSubmissionTransaction(
  database: ReturnType<typeof createWebSocketClientFromEvent>,
  options: PersistUploadedPhotoSubmissionOptions
): Promise<PhotoSubmissionTransactionResult> {
  const { cloudflareImageId, filename, idempotencyKey, itemId, sourceType, sourceUrl, userId } = options

  return database.transaction(async (transaction) => {
    const [lockedItem] = await transaction
      .select({ id: equipmentItems.id })
      .from(equipmentItems)
      .where(and(eq(equipmentItems.id, itemId), eq(equipmentItems.status, 'approved')))
      .for('update')

    if (lockedItem === undefined) {
      throw createError({
        status: 404,
        statusMessage: 'Equipment item not found'
      })
    }

    const [existingSubmissionRow] = await transaction
      .select({
        cloudflareImageId: equipmentItemPhotoSubmissions.cloudflareImageId,
        id: equipmentItemPhotoSubmissions.id,
        itemId: equipmentItemPhotoSubmissions.itemId,
        status: equipmentItemPhotoSubmissions.status
      })
      .from(equipmentItemPhotoSubmissions)
      .where(and(
        eq(equipmentItemPhotoSubmissions.createdBy, userId),
        eq(equipmentItemPhotoSubmissions.idempotencyKey, idempotencyKey)
      ))
      .limit(1)

    const existingSubmission = mapPersistedPhotoSubmission(existingSubmissionRow)

    if (existingSubmission !== null) {
      validatePhotoSubmissionIdempotencyItem(existingSubmission, itemId)

      return {
        isCreated: false,
        submission: existingSubmission
      }
    }

    const pendingSubmissions = await transaction
      .select({ id: equipmentItemPhotoSubmissions.id })
      .from(equipmentItemPhotoSubmissions)
      .where(and(
        eq(equipmentItemPhotoSubmissions.createdBy, userId),
        eq(equipmentItemPhotoSubmissions.itemId, itemId),
        eq(equipmentItemPhotoSubmissions.status, 'pending')
      ))
      .limit(maximumPendingPhotoSubmissionCount)

    if (pendingSubmissions.length >= maximumPendingPhotoSubmissionCount) {
      throw createPendingPhotoSubmissionLimitError()
    }

    const [submission] = await transaction
      .insert(equipmentItemPhotoSubmissions)
      .values({
        cloudflareImageId,
        createdBy: userId,
        filename,
        idempotencyKey,
        itemId,
        rightsConfirmed: true,
        sourceType,
        sourceUrl: sourceUrl ?? null,
        status: 'pending'
      })
      .returning({
        cloudflareImageId: equipmentItemPhotoSubmissions.cloudflareImageId,
        id: equipmentItemPhotoSubmissions.id,
        itemId: equipmentItemPhotoSubmissions.itemId,
        status: equipmentItemPhotoSubmissions.status
      })

    const createdSubmission = mapPersistedPhotoSubmission(submission)

    if (createdSubmission === null) {
      throw new Error('Photo submission insert returned no row')
    }

    await transaction.insert(contributions).values({
      action: 'submit_item_photo',

      metadata: {
        filename,
        itemId,
        sourceType,
        status: 'pending'
      },

      targetId: createdSubmission.id,
      userId
    })

    return {
      isCreated: true,
      submission: createdSubmission
    }
  })
}

async function persistUploadedPhotoSubmission(
  options: PersistUploadedPhotoSubmissionOptions
): Promise<PersistedPhotoSubmission> {
  const { binding, cloudflareImageId, event, itemId } = options
  let database: ReturnType<typeof createWebSocketClientFromEvent> | null = null
  let transactionError: unknown = null
  let transactionResult: PhotoSubmissionTransactionResult | null = null

  try {
    database = createWebSocketClientFromEvent(event)
    transactionResult = await executePhotoSubmissionTransaction(database, options)
  } catch (error) {
    transactionError = error
  } finally {
    await closePhotoSubmissionDatabase(database, itemId)
  }

  if (transactionResult === null) {
    return reconcilePhotoSubmissionFailure(options, transactionError)
  }

  if (
    transactionResult.isCreated === false
    && transactionResult.submission.cloudflareImageId !== cloudflareImageId
  ) {
    await deleteUnattachedHostedEquipmentImage({
      binding,
      cloudflareImageId
    })
  }

  return transactionResult.submission
}

export {
  findPersistedPhotoSubmission,
  persistUploadedPhotoSubmission
}
