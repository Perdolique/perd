import { defineEventHandler } from 'h3'

interface CategoryListItem {
  id: number;
  name: string;
  slug: string;
}

export default defineEventHandler(async (event) : Promise<CategoryListItem[]> =>
  event.context.dbHttp.query.equipmentCategories.findMany({
    columns: {
      id: true,
      name: true,
      slug: true
    }
  })
)
