import { scheduleBackgroundTask } from '#server/utils/request-runtime'
import type { InferInput } from 'valibot'
import { createError, defineEventHandler, isNuxtError, readValidatedBody } from 'nuxt/server'
import { getValidatedRouteParams } from '#server/utils/request'
import type { ApiRequestEvent } from '#shared/types/api-request'
import { validateAdminUser } from '#server/utils/admin'
import { getCloudflareImagesBinding } from '#server/utils/cloudflare'
import { createRuntimeWebSocketClient } from '#server/utils/config'

import {
  deletePublishedSubmissionSourceImage,
  deleteUnattachedPublishedImage,
  preparePhotoPublication,
  reconcilePublicationFailure,
  type PreparedPhotoPublication
} from '#server/utils/equipment/photo-submission-publication'

import {
  executePhotoSubmissionDecision,
  type PhotoSubmissionDecisionResponse,
  type PhotoSubmissionReviewDatabase
} from '#server/utils/equipment/photo-submission-review'

import {
  validatePhotoSubmissionDecisionBody,
  validatePhotoSubmissionParams,
  type photoSubmissionDecisionBodySchema
} from '#server/utils/validation/schemas'

async function closePhotoSubmissionReviewDatabase(
  database: PhotoSubmissionReviewDatabase | null,
  submissionId: string
): Promise<void> {
  if (database === null) {
    return
  }

  try {
    await database.$client.end()
  } catch (error) {
    console.error('Failed to close photo submission review database client', {
      error,
      submissionId
    })
  }
}

function throwPhotoSubmissionReviewError(error: unknown, submissionId: string): never {
  if (isNuxtError(error)) {
    throw error
  }

  console.error('Failed to review equipment photo submission', {
    error,
    submissionId
  })

  throw createError({
    status: 500,
    statusText: 'Failed to review photo submission'
  })
}

export default defineEventHandler(async (event: ApiRequestEvent<{ body: InferInput<typeof photoSubmissionDecisionBodySchema>; }>): Promise<PhotoSubmissionDecisionResponse> => {
  const userId = await validateAdminUser(event)
  const { id } = await getValidatedRouteParams(event, validatePhotoSubmissionParams)
  const body = await readValidatedBody(event, validatePhotoSubmissionDecisionBody)
  let database: PhotoSubmissionReviewDatabase | null = null
  let publication: PreparedPhotoPublication | null = null

  try {
    if (body.decision === 'publish') {
      const imagesBinding = getCloudflareImagesBinding(event)

      publication = await preparePhotoPublication(event, imagesBinding, id)
    }

    database = createRuntimeWebSocketClient()

    const response = await executePhotoSubmissionDecision({
      body,
      database,
      publication,
      submissionId: id,
      userId
    })

    if (publication !== null) {
      scheduleBackgroundTask(event, deletePublishedSubmissionSourceImage(publication.sourceImage, id))
    }

    return response
  } catch (error) {
    if (publication !== null) {
      if (isNuxtError(error)) {
        await deleteUnattachedPublishedImage(publication.publicImage, error, id)
      } else {
        const reconciledResponse = await reconcilePublicationFailure({
          error,
          event,
          publication,
          submissionId: id
        })

        if (reconciledResponse !== null) {
          scheduleBackgroundTask(event, deletePublishedSubmissionSourceImage(publication.sourceImage, id))

          return reconciledResponse
        }
      }
    }

    throwPhotoSubmissionReviewError(error, id)
  } finally {
    await closePhotoSubmissionReviewDatabase(database, id)
  }
})

export type {
  ApprovedPhotoSubmissionResponse,
  PhotoSubmissionDecisionResponse,
  PublishedPhotoSubmissionImage,
  RejectedPhotoSubmissionResponse
} from '#server/utils/equipment/photo-submission-review'
