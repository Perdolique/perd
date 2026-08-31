import { inArray } from 'drizzle-orm'
import { equipmentItemImages, equipmentItemPhotoSubmissions } from '#server/database/schema'
import type { createHttpClient } from '#server/utils/database'

type PhotoSubmissionCleanupDatabase = ReturnType<typeof createHttpClient>

interface PhotoSubmissionImageReferences {
  publishedImageIds: Set<string>;
  submissionStatuses: Map<string, string>;
}

type PhotoSubmissionImageReferenceLookup = (
  cloudflareImageIds: string[]
) => Promise<PhotoSubmissionImageReferences>

async function getPhotoSubmissionImageReferences(
  database: PhotoSubmissionCleanupDatabase,
  cloudflareImageIds: string[]
): Promise<PhotoSubmissionImageReferences> {
  if (cloudflareImageIds.length === 0) {
    return {
      publishedImageIds: new Set(),
      submissionStatuses: new Map()
    }
  }

  const [publishedImages, submissions] = await Promise.all([
    database
      .select({
        cloudflareImageId: equipmentItemImages.cloudflareImageId
      })
      .from(equipmentItemImages)
      .where(
        inArray(equipmentItemImages.cloudflareImageId, cloudflareImageIds)
      ),

    database
      .select({
        cloudflareImageId: equipmentItemPhotoSubmissions.cloudflareImageId,
        status: equipmentItemPhotoSubmissions.status
      })
      .from(equipmentItemPhotoSubmissions)
      .where(
        inArray(equipmentItemPhotoSubmissions.cloudflareImageId, cloudflareImageIds)
      )
  ])

  const publishedImageIds = new Set(
    publishedImages.map((image) => image.cloudflareImageId)
  )

  const submissionStatuses = new Map(
    submissions.map((submission) => [
      submission.cloudflareImageId,
      submission.status
    ])
  )

  return {
    publishedImageIds,
    submissionStatuses
  }
}

export {
  getPhotoSubmissionImageReferences
}

export type {
  PhotoSubmissionImageReferenceLookup,
  PhotoSubmissionImageReferences
}
