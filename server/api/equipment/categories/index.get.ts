import { defineEventHandler } from 'h3'

interface CategoryListItem {
  id: number;
  name: string;
  slug: string;
}

type CategoriesListResponse = CategoryListItem[]

export default defineEventHandler(async (event) : Promise<CategoriesListResponse> =>
  event.context.dbHttp.query.equipmentCategories.findMany({
    columns: {
      id: true,
      name: true,
      slug: true
    }
  })
)

export type { CategoriesListResponse }
