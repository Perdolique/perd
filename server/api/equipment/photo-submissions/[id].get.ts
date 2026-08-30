import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { validatePhotoSubmissionParams } from '#server/utils/validation/schemas'
import type { PhotoSubmissionAuthorSummary, PhotoSubmissionItemSummary } from './index.get'

interface PhotoSubmissionDetailResponse {
  author: PhotoSubmissionAuthorSummary | null;
  createdAt: Date | string;
  filename: string;
  hasExistingImages: boolean;
  id: string;
  item: PhotoSubmissionItemSummary;
  previewUrl: string;
  rightsConfirmed: boolean;
  sourceType: 'manufacturer' | 'own';
  sourceUrl: string | null;
  updatedAt: Date | string;
}

interface PhotoSubmissionDetailQueryImage {
  id: string;
}

interface PhotoSubmissionDetailQueryItem {
  brand: PhotoSubmissionItemSummary['brand'] | null;
  category: PhotoSubmissionItemSummary['category'] | null;
  id: string;
  images: PhotoSubmissionDetailQueryImage[];
  name: string;
}

interface PhotoSubmissionDetailQueryRow {
  createdAt: Date;
  creator: PhotoSubmissionAuthorSummary | null;
  filename: string;
  id: string;
  item: PhotoSubmissionDetailQueryItem | null;
  rightsConfirmed: boolean;
  sourceType: string;
  sourceUrl: string | null;
  updatedAt: Date;
}

function mapSourceType(sourceType: string): PhotoSubmissionDetailResponse['sourceType'] {
  if (sourceType === 'manufacturer' || sourceType === 'own') {
    return sourceType
  }

  throw new Error(`Unexpected photo submission source type: ${sourceType}`)
}

export default defineEventHandler(async (event): Promise<PhotoSubmissionDetailResponse> => {
  await validateAdminUser(event)

  const { id } = await getValidatedRouterParams(event, validatePhotoSubmissionParams)

  const submission: PhotoSubmissionDetailQueryRow | undefined
    = await event.context.dbHttp.query.equipmentItemPhotoSubmissions.findFirst({
      columns: {
        createdAt: true,
        filename: true,
        id: true,
        rightsConfirmed: true,
        sourceType: true,
        sourceUrl: true,
        updatedAt: true
      },

      where: {
        id,
        status: 'pending'
      },

      with: {
        creator: {
          columns: {
            id: true,
            name: true
          }
        },

        item: {
          columns: {
            id: true,
            name: true
          },

          with: {
            brand: {
              columns: {
                id: true,
                name: true
              }
            },

            category: {
              columns: {
                id: true,
                name: true
              }
            },

            images: {
              columns: {
                id: true
              },

              limit: 1
            }
          }
        }
      }
    })

  if (submission === undefined) {
    throw createError({ status: 404 })
  }

  const { item } = submission

  if (item === null) {
    throw new Error(`Photo submission ${submission.id} has missing equipment data`)
  }

  if (item.brand === null || item.category === null) {
    throw new Error(`Photo submission ${submission.id} has missing equipment data`)
  }

  return {
    author: submission.creator,
    createdAt: submission.createdAt,
    filename: submission.filename,
    hasExistingImages: item.images.length > 0,
    id: submission.id,

    item: {
      brand: item.brand,
      category: item.category,
      id: item.id,
      name: item.name
    },

    previewUrl: `/api/equipment/photo-submissions/${submission.id}/image`,
    rightsConfirmed: submission.rightsConfirmed,
    sourceType: mapSourceType(submission.sourceType),
    sourceUrl: submission.sourceUrl,
    updatedAt: submission.updatedAt
  }
})

export type { PhotoSubmissionDetailResponse }
