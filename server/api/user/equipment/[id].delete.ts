import * as v from 'valibot'
import { and, eq } from 'drizzle-orm'

const paramsSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1))
})

type ParamsData = v.InferOutput<typeof paramsSchema>

function validateParam(param: unknown) {
  return v.parse(paramsSchema, param)
}

export default defineEventHandler(async (event) => {
  const session = await useAppSession(event)
  const { userId } = session.data
  const params = await getValidatedRouterParams(event, validateParam)

  if (userId === undefined) {
    throw createError({
      statusCode: 401
    })
  }

  await event.context.db
    .delete(tables.userEquipment)
    .where(
      and(
        eq(tables.userEquipment.userId, userId),
        eq(tables.userEquipment.equipmentId, params.id)
      )
    )

  setResponseStatus(event, 204)
})
