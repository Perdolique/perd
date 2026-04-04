import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) =>
  event.context.dbHttp.query.equipmentCategories.findMany({
    columns: {
      id: true,
      name: true,
      slug: true
    }
  })
)
