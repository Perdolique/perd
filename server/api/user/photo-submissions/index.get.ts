import { defineEventHandler } from 'h3'
import { validateRegisteredUser } from '#server/utils/user'

interface UserPhotoSubmissionItem {
  id: string;
  name: string;
}

interface UserPhotoSubmission {
  createdAt: Date | string;
  filename: string;
  id: string;
  item: UserPhotoSubmissionItem;
  sourceType: 'manufacturer' | 'own';
  sourceUrl: string | null;
  status: 'pending';
  updatedAt: Date | string;
}

interface UserPhotoSubmissionsResponse {
  items: UserPhotoSubmission[];
}

interface UserPhotoSubmissionQueryRow {
  createdAt: Date;
  filename: string;
  id: string;
  item: UserPhotoSubmissionItem | null;
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
  if (status === 'pending') {
    return status
  }

  throw new Error(`Unexpected photo submission status: ${status}`)
}

export default defineEventHandler(async (event): Promise<UserPhotoSubmissionsResponse> => {
  const userId = await validateRegisteredUser(event)

  const submissions = await event.context.dbHttp.query.equipmentItemPhotoSubmissions.findMany({
    columns: {
      createdAt: true,
      filename: true,
      id: true,
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

    with: {
      item: {
        columns: {
          id: true,
          name: true
        }
      }
    }
  })

  const items = submissions.map((submission: UserPhotoSubmissionQueryRow) => {
    if (submission.item === null) {
      throw new Error(`Photo submission ${submission.id} has missing equipment item`)
    }

    return {
      createdAt: submission.createdAt,
      filename: submission.filename,
      id: submission.id,
      item: submission.item,
      sourceType: mapSourceType(submission.sourceType),
      sourceUrl: submission.sourceUrl,
      status: mapStatus(submission.status),
      updatedAt: submission.updatedAt
    }
  })

  return { items }
})

export type {
  UserPhotoSubmission,
  UserPhotoSubmissionsResponse
}
