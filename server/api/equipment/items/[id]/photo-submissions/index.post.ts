import { createError, defineEventHandler, getValidatedRouterParams, isError, setResponseStatus } from 'h3'

import {
  contributions,
  equipmentItemPhotoSubmissions
} from '#server/database/schema'

import { getCloudflareImagesBinding } from '#server/utils/cloudflare'
import { createWebSocketClientFromEvent } from '#server/utils/config'

import {
  createEquipmentItemImageBody,
  deleteUnattachedHostedEquipmentImage,
  uploadHostedEquipmentImage
} from '#server/utils/equipment/item-images'

import {
  readLimitedMultipartFormData,
  validatePhotoSubmissionMultipartRequest
} from '#server/utils/equipment/photo-submission-form'

import { validateRegisteredUser } from '#server/utils/user'

import {
  validateItemDetailParams,
  validatePhotoSubmissionCreateBody
} from '#server/utils/validation/schemas'

interface PhotoSubmissionCreateResponse {
  id: string;
  status: 'pending';
}

function getStringFormDataValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name)

  return typeof value === 'string' ? value : undefined
}

export default defineEventHandler(async (event): Promise<PhotoSubmissionCreateResponse> => {
  const userId = await validateRegisteredUser(event)
  const { id: itemId } = await getValidatedRouterParams(event, validateItemDetailParams)
  const contentType = validatePhotoSubmissionMultipartRequest(event)

  const item = await event.context.dbHttp.query.equipmentItems.findFirst({
    columns: {
      id: true
    },

    where: {
      id: itemId,
      status: 'approved'
    }
  })

  if (item === undefined) {
    throw createError({
      status: 404,
      statusMessage: 'Equipment item not found'
    })
  }

  const formData = await readLimitedMultipartFormData(event, contentType)
  const photo = formData.get('photo')

  if ((photo instanceof globalThis.File) === false) {
    throw createError({
      status: 400,
      statusMessage: 'Photo file is required'
    })
  }

  const {
    filename,
    sourceType,
    sourceUrl
  } = validatePhotoSubmissionCreateBody({
    filename: photo.name,
    rightsConfirmed: getStringFormDataValue(formData, 'rightsConfirmed'),
    sourceType: getStringFormDataValue(formData, 'sourceType'),
    sourceUrl: getStringFormDataValue(formData, 'sourceUrl')
  })

  const imagesBinding = getCloudflareImagesBinding(event)
  const imageBody = await createEquipmentItemImageBody({
    declaredByteLength: photo.size,
    mediaType: photo.type,
    stream: photo.stream()
  })

  const cloudflareImageId = await uploadHostedEquipmentImage({
    binding: imagesBinding,
    body: imageBody,
    creator: userId,
    filename,

    metadata: {
      itemId,
      kind: 'equipment-photo-submission'
    },

    requireSignedURLs: true
  })

  let dbWebsocket: ReturnType<typeof createWebSocketClientFromEvent> | null = null

  try {
    dbWebsocket = createWebSocketClientFromEvent(event)

    const createdSubmission = await dbWebsocket.transaction(async (transaction) => {
      const [submission] = await transaction
        .insert(equipmentItemPhotoSubmissions)
        .values({
          cloudflareImageId,
          createdBy: userId,
          filename,
          itemId,
          rightsConfirmed: true,
          sourceType,
          sourceUrl: sourceUrl ?? null,
          status: 'pending'
        })
        .returning({
          id: equipmentItemPhotoSubmissions.id,
          status: equipmentItemPhotoSubmissions.status
        })

      if (submission === undefined) {
        throw new Error('Photo submission insert returned no row')
      }

      await transaction
        .insert(contributions)
        .values({
          action: 'submit_item_photo',

          metadata: {
            filename,
            itemId,
            sourceType,
            status: 'pending'
          },

          targetId: submission.id,
          userId
        })

      return {
        id: submission.id,
        status: 'pending' as const
      }
    })

    setResponseStatus(event, 201)

    return createdSubmission
  } catch (error) {
    await deleteUnattachedHostedEquipmentImage({
      binding: imagesBinding,
      cloudflareImageId
    })

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
  } finally {
    await dbWebsocket?.$client.end()
  }
})

export type {
  PhotoSubmissionCreateResponse
}
