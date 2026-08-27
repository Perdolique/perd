import { count, eq } from 'drizzle-orm'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { equipmentItemPhotoSubmissions } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { validatePhotoSubmissionAdminListQuery } from '#server/utils/validation/schemas'

interface PhotoSubmissionReferenceSummary {
  id: number;
  name: string;
}

interface PhotoSubmissionAuthorSummary {
  id: string;
  name: string | null;
}

interface PhotoSubmissionItemSummary {
  brand: PhotoSubmissionReferenceSummary;
  category: PhotoSubmissionReferenceSummary;
  id: string;
  name: string;
}

interface PhotoSubmissionListItem {
  author: PhotoSubmissionAuthorSummary | null;
  createdAt: Date | string;
  filename: string;
  id: string;
  item: PhotoSubmissionItemSummary;
}

interface PhotoSubmissionListResponse {
  items: PhotoSubmissionListItem[];
  limit: number;
  page: number;
  total: number;
}

interface PhotoSubmissionListQueryItem {
  brand: PhotoSubmissionReferenceSummary | null;
  category: PhotoSubmissionReferenceSummary | null;
  id: string;
  name: string;
}

interface PhotoSubmissionListQueryRow {
  createdAt: Date;
  creator: PhotoSubmissionAuthorSummary | null;
  filename: string;
  id: string;
  item: PhotoSubmissionListQueryItem | null;
}

export default defineEventHandler(async (event): Promise<PhotoSubmissionListResponse> => {
  await validateAdminUser(event)

  const { limit, page } = await getValidatedQuery(event, validatePhotoSubmissionAdminListQuery)
  const { dbHttp } = event.context
  const offset = (page - 1) * limit

  const itemsPromise = dbHttp.query.equipmentItemPhotoSubmissions.findMany({
    columns: {
      createdAt: true,
      filename: true,
      id: true
    },

    where: {
      status: 'pending'
    },

    orderBy: {
      createdAt: 'asc',
      id: 'asc'
    },

    limit,
    offset,

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
          }
        }
      }
    }
  })

  const totalPromise = dbHttp
    .select({ total: count() })
    .from(equipmentItemPhotoSubmissions)
    .where(eq(equipmentItemPhotoSubmissions.status, 'pending'))

  const [rows, totalRows] = await Promise.all([
    itemsPromise,
    totalPromise
  ])

  const items = rows.map((submission: PhotoSubmissionListQueryRow) => {
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
      id: submission.id,

      item: {
        brand: item.brand,
        category: item.category,
        id: item.id,
        name: item.name
      }
    }
  })

  return {
    items,
    limit,
    page,
    total: totalRows[0]?.total ?? 0
  }
})

export type {
  PhotoSubmissionAuthorSummary,
  PhotoSubmissionItemSummary,
  PhotoSubmissionListItem,
  PhotoSubmissionListResponse,
  PhotoSubmissionReferenceSummary
}
