import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) =>
  event.context.dbHttp.query.equipmentGroups.findMany({
    columns: {
      id: true,
      name: true,
      slug: true
    }
  })
)
