import { count, eq } from 'drizzle-orm'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { equipmentItems } from '#server/database/schema'
import { validateAdminUser } from '#server/utils/admin'
import { validateItemSubmissionListQuery } from '#server/utils/validation/schemas'

interface ItemSubmissionReferenceSummary {
  id: number;
  name: string;
}

interface ItemSubmissionAuthorSummary {
  id: string;
  name: string | null;
}

interface ItemSubmissionListItem {
  author: ItemSubmissionAuthorSummary | null;
  brand: ItemSubmissionReferenceSummary;
  category: ItemSubmissionReferenceSummary;
  createdAt: Date | string;
  id: string;
  name: string;
}

interface ItemSubmissionListResponse {
  items: ItemSubmissionListItem[];
  limit: number;
  page: number;
  total: number;
}

interface ItemSubmissionQueryRow {
  brand: ItemSubmissionReferenceSummary | null;
  category: ItemSubmissionReferenceSummary | null;
  createdAt: Date;
  creator: ItemSubmissionAuthorSummary | null;
  id: string;
  name: string;
}

export default defineEventHandler(async (event): Promise<ItemSubmissionListResponse> => {
  await validateAdminUser(event)

  const { limit, page } = await getValidatedQuery(event, validateItemSubmissionListQuery)
  const { dbHttp } = event.context
  const offset = (page - 1) * limit

  const itemsPromise = dbHttp.query.equipmentItems.findMany({
    columns: {
      createdAt: true,
      id: true,
      name: true
    },

    limit,
    offset,

    orderBy: {
      createdAt: 'asc',
      id: 'asc'
    },

    where: {
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
      }
    }
  })

  const totalPromise = dbHttp
    .select({ total: count() })
    .from(equipmentItems)
    .where(eq(equipmentItems.status, 'pending'))

  const [items, totalRows] = await Promise.all([
    itemsPromise,
    totalPromise
  ])

  const mappedItems = items.map((item: ItemSubmissionQueryRow) => {
    if (item.brand === null || item.category === null) {
      throw new Error(`Equipment item ${item.id} has missing reference data`)
    }

    return {
      author: item.creator,
      brand: item.brand,
      category: item.category,
      createdAt: item.createdAt,
      id: item.id,
      name: item.name
    }
  })

  return {
    items: mappedItems,
    limit,
    page,
    total: totalRows[0]?.total ?? 0
  }
})

export type {
  ItemSubmissionAuthorSummary,
  ItemSubmissionListItem,
  ItemSubmissionListResponse,
  ItemSubmissionReferenceSummary
}
