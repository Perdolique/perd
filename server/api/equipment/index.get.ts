import * as v from 'valibot'
import { asc, count } from 'drizzle-orm'

interface Meta {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

interface Data {
  readonly id: number;
  readonly name: string;
  readonly status: string;
}

interface ReturnData {
  readonly data: Data[];
  readonly meta: Meta;
}

function validateQuery(query: unknown) {
  return v.parse(v.object({
    page: v.union([
      v.undefined(),
      stringToIntegerValidator
    ]),
  }), query)
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const query = await getValidatedQuery(event, validateQuery)
  const limit = 3;
  const page = query.page ?? 1;
  const offset = limit * (page - 1);

  const equipmentCountPromise = event.context.db
    .select({
      count: count()
    })
    .from(tables.equipment)

  const resultPromise = event.context.db
    .select({
      id: tables.equipment.id,
      name: tables.equipment.name,
      status: tables.equipment.status
    })
    .from(tables.equipment)
    .orderBy(asc(tables.equipment.name))
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
