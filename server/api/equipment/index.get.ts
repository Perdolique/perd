import * as v from 'valibot'
import { and, asc, count, eq, ilike } from 'drizzle-orm'
import type { EquipmentStatus } from '#shared/models/equipment';

interface Meta {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

interface Data {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly weight: number;
}

interface ReturnData {
  readonly data: Data[];
  readonly meta: Meta;
}

function validateQuery(query: unknown) {
  return v.parse(v.object({
    page: v.optional(
      stringToIntegerValidator
    ),

    search: v.optional(
        v.pipe(
        v.string(),
        v.nonEmpty()
      )
    ),

    status: v.optional(
      v.pipe(
        v.string(),

        v.union([
          v.literal<EquipmentStatus>('active'),
          v.literal<EquipmentStatus>('draft')
        ])
      )
    )
  }), query)
}

function generateFilter({ search, status } : ReturnType<typeof validateQuery>) {
  const filters = [];

  if (search !== undefined) {
    filters.push(
      ilike(tables.equipment.name, `%${search}%`)
    )
  }

  if (status !== undefined) {
    filters.push(
      eq(tables.equipment.status, status)
    )
  }

  return filters;
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const query = await getValidatedQuery(event, validateQuery)
  const limit = 3;
  const page = query.page ?? 1;
  const offset = limit * (page - 1);
  const filter = generateFilter(query);

  const equipmentCountPromise = event.context.db
    .select({
      count: count()
    })
    .from(tables.equipment)
    .where(
      and(...filter)
    )

  const resultPromise = event.context.db
    .select({
      id: tables.equipment.id,
      name: tables.equipment.name,
      status: tables.equipment.status,
      weight: tables.equipment.weight
    })
    .from(tables.equipment)
    .where(
      and(...filter)
    )
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
