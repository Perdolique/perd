import { createError, defineEventHandler, getValidatedRouterParams } from 'h3'
import { validateAdminUser } from '#server/utils/admin'
import { validateItemSubmissionParams } from '#server/utils/validation/schemas'
import type { ItemSubmissionListItem } from './index.get'

interface ItemSubmissionPropertyValue {
  propertyId: number;
  value: boolean | string;
}

interface ItemSubmissionDetailResponse extends ItemSubmissionListItem {
  properties: ItemSubmissionPropertyValue[];
  updatedAt: Date | string;
}

function mapPropertyValue(value: {
  propertyId: number;
  valueBoolean: boolean | null;
  valueNumber: string | null;
  valueText: string | null;
}): ItemSubmissionPropertyValue {
  if (value.valueBoolean !== null) {
    return {
      propertyId: value.propertyId,
      value: value.valueBoolean
    }
  }

  const stringValue = value.valueNumber ?? value.valueText

  if (stringValue === null) {
    throw new Error(`Equipment item property ${value.propertyId} has no value`)
  }

  return {
    propertyId: value.propertyId,
    value: stringValue
  }
}

export default defineEventHandler(async (event): Promise<ItemSubmissionDetailResponse> => {
  await validateAdminUser(event)

  const { id } = await getValidatedRouterParams(event, validateItemSubmissionParams)

  const item = await event.context.dbHttp.query.equipmentItems.findFirst({
    columns: {
      createdAt: true,
      id: true,
      name: true,
      updatedAt: true
    },

    where: {
      id,
      status: 'pending'
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

      creator: {
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
        }
      }
    }
  })

  if (item === undefined) {
    throw createError({ status: 404 })
  }

  if (item.brand === null || item.category === null) {
    throw new Error(`Equipment item ${item.id} has missing reference data`)
  }

  return {
    author: item.creator,
    brand: item.brand,
    category: item.category,
    createdAt: item.createdAt,
    id: item.id,
    name: item.name,
    properties: item.propertyValues.map(mapPropertyValue),
    updatedAt: item.updatedAt
  }
})

export type {
  ItemSubmissionDetailResponse,
  ItemSubmissionPropertyValue
}
