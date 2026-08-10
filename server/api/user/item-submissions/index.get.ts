import { defineEventHandler } from 'h3'
import { validateRegisteredUser } from '#server/utils/user'

interface UserItemSubmissionReference {
  id: number;
  name: string;
}

interface UserItemSubmissionProperty {
  name: string;
  propertyId: number;
  unit: string | null;
  value: boolean | string;
}

interface UserItemSubmission {
  brand: UserItemSubmissionReference;
  category: UserItemSubmissionReference;
  createdAt: Date | string;
  id: string;
  name: string;
  properties: UserItemSubmissionProperty[];
  rejectionReason: string | null;
  status: 'approved' | 'pending' | 'rejected';
  updatedAt: Date | string;
}

interface UserItemSubmissionsResponse {
  items: UserItemSubmission[];
}

interface UserItemSubmissionPropertyReference {
  name: string;
  unit: string | null;
}

interface UserItemSubmissionPropertyRow {
  propertyId: number;
  property: UserItemSubmissionPropertyReference | null;
  valueBoolean: boolean | null;
  valueNumber: string | null;
  valueText: string | null;
}

interface UserItemSubmissionQueryRow {
  brand: UserItemSubmissionReference | null;
  category: UserItemSubmissionReference | null;
  createdAt: Date;
  id: string;
  name: string;
  propertyValues: UserItemSubmissionPropertyRow[];
  rejectionReason: string | null;
  status: string;
  updatedAt: Date;
}

function mapPropertyValue(value: UserItemSubmissionPropertyRow): UserItemSubmissionProperty {
  if (value.property === null) {
    throw new Error(`Equipment item property ${value.propertyId} has missing definition`)
  }

  const propertyValue = value.valueBoolean ?? value.valueNumber ?? value.valueText

  if (propertyValue === null) {
    throw new Error(`Equipment item property ${value.propertyId} has no value`)
  }

  return {
    name: value.property.name,
    propertyId: value.propertyId,
    unit: value.property.unit,
    value: propertyValue
  }
}

function mapSubmissionStatus(status: string): UserItemSubmission['status'] {
  if (status === 'approved' || status === 'pending' || status === 'rejected') {
    return status
  }

  throw new Error(`Unexpected equipment item submission status: ${status}`)
}

export default defineEventHandler(async (event): Promise<UserItemSubmissionsResponse> => {
  const userId = await validateRegisteredUser(event)

  const items = await event.context.dbHttp.query.equipmentItems.findMany({
    columns: {
      createdAt: true,
      id: true,
      name: true,
      rejectionReason: true,
      status: true,
      updatedAt: true
    },

    where: {
      createdBy: userId,
      status: {
        in: ['approved', 'pending', 'rejected']
      }
    },

    orderBy: {
      createdAt: 'desc',
      id: 'desc'
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

      propertyValues: {
        columns: {
          propertyId: true,
          valueBoolean: true,
          valueNumber: true,
          valueText: true
        },

        orderBy: {
          propertyId: 'asc'
        },

        with: {
          property: {
            columns: {
              name: true,
              unit: true
            }
          }
        }
      }
    }
  })

  const mappedItems = items.map((item: UserItemSubmissionQueryRow) => {
    if (item.brand === null || item.category === null) {
      throw new Error(`Equipment item ${item.id} has missing reference data`)
    }

    return {
      brand: item.brand,
      category: item.category,
      createdAt: item.createdAt,
      id: item.id,
      name: item.name,
      properties: item.propertyValues.map(mapPropertyValue),
      rejectionReason: item.rejectionReason,
      status: mapSubmissionStatus(item.status),
      updatedAt: item.updatedAt
    }
  })

  return { items: mappedItems }
})

export type {
  UserItemSubmission,
  UserItemSubmissionProperty,
  UserItemSubmissionsResponse
}
