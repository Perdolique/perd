import { defineEventHandler, getValidatedQuery } from 'h3'
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

interface PhotoSubmissionListCursor {
  createdAt: string;
  id: string;
}

interface PhotoSubmissionListResponse {
  items: PhotoSubmissionListItem[];
  nextCursor: PhotoSubmissionListCursor | null;
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

  const {
    afterCreatedAt,
    afterId,
    limit
  } = await getValidatedQuery(event, validatePhotoSubmissionAdminListQuery)

  const { dbHttp } = event.context

  const cursor = afterCreatedAt === undefined || afterId === undefined
    ? null
    : {
        createdAt: new Date(afterCreatedAt),
        id: afterId
      }

  const pendingStatus = 'pending' as const

  const where = cursor === null
    ? {
        status: pendingStatus
      }
    : {
        status: pendingStatus,

        OR: [
          {
            createdAt: {
              gt: cursor.createdAt
            }
          },
          {
            createdAt: {
              eq: cursor.createdAt
            },

            id: {
              gt: cursor.id
            }
          }
        ]
      }

  const rows = await dbHttp.query.equipmentItemPhotoSubmissions.findMany({
    columns: {
      createdAt: true,
      filename: true,
      id: true
    },

    where,

    orderBy: {
      createdAt: 'asc',
      id: 'asc'
    },

    limit: limit + 1,

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

  const hasMore = rows.length > limit
  const pageRows = rows.slice(0, limit)

  const items = pageRows.map((submission: PhotoSubmissionListQueryRow) => {
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

  const lastSubmission = pageRows.at(-1)

  const nextCursor = hasMore && lastSubmission !== undefined
    ? {
        createdAt: lastSubmission.createdAt.toISOString(),
        id: lastSubmission.id
      }
    : null

  return {
    items,
    nextCursor
  }
})

export type {
  PhotoSubmissionAuthorSummary,
  PhotoSubmissionItemSummary,
  PhotoSubmissionListCursor,
  PhotoSubmissionListItem,
  PhotoSubmissionListResponse,
  PhotoSubmissionReferenceSummary
}
