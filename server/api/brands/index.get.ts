import * as v from 'valibot'
import { asc, count, eq, sql } from 'drizzle-orm'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { stringToIntegerValidator } from '#server/utils/validate'
import { tables } from '#server/utils/database'

interface Data {
  id: number;
  name: string;
  websiteUrl: string | null;
  equipmentCount: number;
}

interface Meta {
  limit: number;
  offset: number;
  total: number;
}

interface ReturnType {
  data: Data[];
  meta: Meta;
}

interface BrandsQueryResult {
  id: number;
  name: string;
  websiteUrl: string | null;
  equipmentCount: number;
  total: number;
}

function validateQuery(query: unknown) {
  return v.parse(v.object({
    page: v.optional(
      stringToIntegerValidator
    )
  }), query)
}

export default defineEventHandler(async (event) : Promise<ReturnType> => {
  const query = await getValidatedQuery(event, validateQuery)
  const limit = 50;
  const page = query.page ?? 1;
  const offset = limit * (page - 1);

  const result : BrandsQueryResult[] = await event.context.db
    .select({
      id: tables.brands.id,
      name: tables.brands.name,
      websiteUrl: tables.brands.websiteUrl,
      equipmentCount: count(tables.equipment.id),
      total: sql<number>`count(*) over()`.mapWith(Number)
    })
    .from(tables.brands)
    .leftJoin(
      tables.equipment,
      eq(tables.equipment.brandId, tables.brands.id)
    )
    .groupBy(tables.brands.id)
    .orderBy(
      asc(tables.brands.name)
    )
    .limit(limit)
    .offset(offset)

  const total = result[0]?.total ?? 0
  const data = result.map(({ total, ...item }) => item)

  return {
    data,

    meta: {
      limit,
      offset,
      total
    }
  }
})
