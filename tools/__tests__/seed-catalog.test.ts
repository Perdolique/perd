import { describe, expect, it } from 'vitest'
import { buildCategoryPropertySeedRows } from '../seed-catalog'
import {
  categoryDefinitions,
  propertyDefinitionsByCategorySlug,
  sampleItems
} from '../seed-data'

describe('catalog sample data', () => {
  it('should seed exactly 25 uniquely named catalog items per category', () => {
    const itemCountPerCategory = 25
    const expectedItemCount = categoryDefinitions.length * itemCountPerCategory
    const uniqueItemNames = new Set(sampleItems.map((item) => item.name))

    expect(sampleItems).toHaveLength(expectedItemCount)
    expect(uniqueItemNames.size).toBe(expectedItemCount)

    for (const category of categoryDefinitions) {
      const categoryItems = sampleItems.filter((item) => item.categorySlug === category.slug)

      expect(categoryItems).toHaveLength(itemCountPerCategory)
    }
  })
})

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

  it('should allow negative values only for the sleeping bag temperature rating', () => {
    const categorySlugs = Object.keys(propertyDefinitionsByCategorySlug)
    const categoryIdBySlug = new Map(categorySlugs.map((categorySlug, index) => [categorySlug, index + 1]))
    const rows = buildCategoryPropertySeedRows(categoryIdBySlug)
    const negativeValueRows = rows.filter((row) => row.allowsNegativeValues)
    const sleepingBagsCategoryId = categoryIdBySlug.get('sleeping-bags')

    expect(negativeValueRows).toStrictEqual([
      expect.objectContaining({
        categoryId: sleepingBagsCategoryId,
        slug: 'temperature-rating'
      })
    ])
  })
})
