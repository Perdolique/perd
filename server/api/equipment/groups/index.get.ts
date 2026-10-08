import { defineEventHandler } from 'nuxt/server'
import type { EquipmentGroupBaseRecord } from '#server/utils/equipment/base-records'

export default defineEventHandler(async (event): Promise<EquipmentGroupBaseRecord[]> =>
  event.context.dbHttp.query.equipmentGroups.findMany({
    columns: {
      id: true,
      name: true,
      slug: true
    }
  })
)
