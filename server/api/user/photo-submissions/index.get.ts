import { defineEventHandler, getValidatedQuery } from 'h3'
import { validateRegisteredUser } from '#server/utils/user'
import { validatePhotoSubmissionListQuery } from '#server/utils/validation/schemas'

const photoSubmissionPageSize = 20

interface UserPhotoSubmissionItem {
  id: string;
  name: string;
}

interface UserPhotoSubmission {
  createdAt: Date | string;
  filename: string;
  id: string;
  item: UserPhotoSubmissionItem;
  rejectionReason: string | null;
  sourceType: 'manufacturer' | 'own';
  sourceUrl: string | null;
  status: 'approved' | 'pending' | 'rejected';
  updatedAt: Date | string;
}

interface UserPhotoSubmissionsResponse {
  items: UserPhotoSubmission[];
  nextPage: number | null;
}

interface UserPhotoSubmissionQueryRow {
  createdAt: Date;
  filename: string;
  id: string;
  item: UserPhotoSubmissionItem | null;
  rejectionReason: string | null;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  updatedAt: Date;
}

function mapSourceType(sourceType: string): UserPhotoSubmission['sourceType'] {
  if (sourceType === 'manufacturer' || sourceType === 'own') {
    return sourceType
  }

  throw new Error(`Unexpected photo submission source type: ${sourceType}`)
}

function mapStatus(status: string): UserPhotoSubmission['status'] {
  if (status === 'approved' || status === 'pending' || status === 'rejected') {
    return status
  }

  throw new Error(`Unexpected photo submission status: ${status}`)
}

export default defineEventHandler(async (event): Promise<UserPhotoSubmissionsResponse> => {
  const userId = await validateRegisteredUser(event)
  const { page } = await getValidatedQuery(event, validatePhotoSubmissionListQuery)
  const offset = (page - 1) * photoSubmissionPageSize

  const submissions = await event.context.dbHttp.query.equipmentItemPhotoSubmissions.findMany({
    columns: {
      createdAt: true,
      filename: true,
      id: true,
      rejectionReason: true,
      sourceType: true,
      sourceUrl: true,
      status: true,
      updatedAt: true
    },

    where: {
      createdBy: userId,

      item: {
        status: 'approved'
      }
    },

    orderBy: {
      createdAt: 'desc',
      id: 'desc'
    },

    limit: photoSubmissionPageSize + 1,
    offset,

    with: {
      item: {
        columns: {
          id: true,
          name: true
        }
      }
    }
  })

  const hasNextPage = submissions.length > photoSubmissionPageSize
  const pageSubmissions = submissions.slice(0, photoSubmissionPageSize)

  const items = pageSubmissions.map((submission: UserPhotoSubmissionQueryRow) => {
    if (submission.item === null) {
      throw new Error(`Photo submission ${submission.id} has missing equipment item`)
    }

    return {
      createdAt: submission.createdAt,
      filename: submission.filename,
      id: submission.id,
      item: submission.item,
      rejectionReason: submission.rejectionReason,
      sourceType: mapSourceType(submission.sourceType),
      sourceUrl: submission.sourceUrl,
      status: mapStatus(submission.status),
      updatedAt: submission.updatedAt
    }
  })

  return {
    items,
    nextPage: hasNextPage ? page + 1 : null
  }
})

export type {
  UserPhotoSubmission,
  UserPhotoSubmissionsResponse
}
