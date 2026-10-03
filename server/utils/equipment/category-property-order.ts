import { inArray, sql } from 'drizzle-orm'
import { categoryProperties } from '#server/database/schema'
import type { AdminCategoryProperty, PropertiesTransaction } from '#server/utils/equipment/category-properties'

/** Moves positions outside the occupied range before assigning the dense final order. */
async function writePropertyOrder(transaction: PropertiesTransaction, properties: AdminCategoryProperty[], propertyIds: number[]): Promise<void> {
  if (propertyIds.length === 0) {
    return
  }

  const positions = properties.map((property) => property.displayOrder)
  const maximumPosition = Math.max(...positions)
  const offset = maximumPosition + 1
  const temporaryPositions = propertyIds.map((id, index) => sql`when ${id} then ${offset + index}`)
  const finalPositions = propertyIds.map((id, index) => sql`when ${id} then ${index}`)

  await transaction.update(categoryProperties)
    .set({ displayOrder: sql`(case ${categoryProperties.id} ${sql.join(temporaryPositions, sql` `)} end)::integer` })
    .where(
      inArray(categoryProperties.id, propertyIds)
    )

  await transaction.update(categoryProperties)
    .set({ displayOrder: sql`(case ${categoryProperties.id} ${sql.join(finalPositions, sql` `)} end)::integer` })
    .where(
      inArray(categoryProperties.id, propertyIds)
    )
}

export { writePropertyOrder }
