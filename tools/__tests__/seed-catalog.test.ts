import { describe, expect, it } from 'vitest'
import { buildCategoryPropertySeedRows } from '../seed-catalog'
import { propertyDefinitionsByCategorySlug } from '../seed-data'

describe(buildCategoryPropertySeedRows, () => {
  it('should derive zero-based display order from each category definition array', () => {
    const categorySlugs = Object.keys(propertyDefinitionsByCategorySlug)
    const categoryIdBySlug = new Map(categorySlugs.map((categorySlug, index) => [categorySlug, index + 1]))
    const rows = buildCategoryPropertySeedRows(categoryIdBySlug)

    for (const [categorySlug, definitions] of Object.entries(propertyDefinitionsByCategorySlug)) {
      const categoryId = categoryIdBySlug.get(categorySlug)
      const categoryRows = rows.filter((row) => row.categoryId === categoryId)
      const orderedProperties = categoryRows.map((row) => {
        return {
          displayOrder: row.displayOrder,
          slug: row.slug
        }
      })

      const expectedProperties = definitions.map((definition, displayOrder) => {
        return {
          displayOrder,
          slug: definition.slug
        }
      })

      expect(orderedProperties).toStrictEqual(expectedProperties)
    }
  })
})
