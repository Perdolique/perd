import * as v from 'valibot'
import { asc, count, eq } from 'drizzle-orm'

interface Meta {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

interface Data {
  readonly id: number;
  readonly name: string;
}

interface ReturnData {
  readonly data: Data[];
  readonly meta: Meta;
}

function validateQuery(query: unknown) {
  return v.parse(v.object({
    page: v.optional(
      stringToIntegerValidator
    )
  }), query)
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const query = await getValidatedQuery(event, validateQuery)
  const limit = 10;
  const page = query.page ?? 1;
  const offset = limit * (page - 1);
  const filter = eq(tables.equipment.status, 'draft');

  const equipmentCountPromise = event.context.db
    .select({
      count: count()
    })
    .from(tables.equipment)
    .where(filter)

  const resultPromise = event.context.db
    .select({
      id: tables.equipment.id,
      name: tables.equipment.name
    })
    .from(tables.equipment)
    .where(filter)
    .orderBy(asc(tables.equipment.createdAt))
    .limit(limit)
    .offset(offset)

  const [equipmentCount, result] = await Promise.all([equipmentCountPromise, resultPromise])

  if (equipmentCount[0] === undefined) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch equipment count'
    })
  }

  return {
    data: result,

    meta: {
      limit,
      offset,
      total: equipmentCount[0].count
    }
  }
})
