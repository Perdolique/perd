import { asc, eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'

import {
  brands,
  equipmentCategories,
  equipmentItems
} from '#server/database/schema'

import { validateAdminUser } from '#server/utils/admin'

interface CatalogEntitySummary {
  name: string;
  slug: string;
}

interface ItemSubmissionSummary {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  createdAt: Date | string;
  createdBy: string | null;
  id: string;
  name: string;
  status: string;
}

export default defineEventHandler(async (event) : Promise<ItemSubmissionSummary[]> => {
  await validateAdminUser(event)

  return event.context.dbHttp
    .select({
      createdAt: equipmentItems.createdAt,
      createdBy: equipmentItems.createdBy,
      id: equipmentItems.id,
      name: equipmentItems.name,
      status: equipmentItems.status,

      brand: {
        name: brands.name,
        slug: brands.slug
      },

      category: {
        name: equipmentCategories.name,
        slug: equipmentCategories.slug
      }
    })
    .from(equipmentItems)
    .innerJoin(brands, eq(equipmentItems.brandId, brands.id))
    .innerJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
    .where(
      eq(equipmentItems.status, 'pending')
    )
    .orderBy(
      asc(equipmentItems.createdAt),
      asc(equipmentItems.id)
    )
})
