import { eq } from 'drizzle-orm'
import { reset, seed } from 'drizzle-seed'

import {
  brands,
  categoryProperties,
  contributions,
  equipmentCategories,
  equipmentGroups,
  equipmentItems,
  itemPropertyValues,
  propertyEnumOptions,
  userEquipment
} from '../server/database/schema'

import type { createWebSocketClient } from '../server/utils/database'

import {
  brandDefinitions,
  categoryDefinitions,
  groupDefinitions,
  propertyDefinitionsByCategorySlug,
  referenceSeed,
  sampleItems
} from './seed-data'
import { assertSampleItemCoverage } from './seed-validation'

type Database = ReturnType<typeof createWebSocketClient>

const catalogSchemaForReset = {
  brands,
  categoryProperties,
  contributions,
  equipmentCategories,
  equipmentGroups,
  equipmentItems,
  itemPropertyValues,
  propertyEnumOptions,
  userEquipment
}

const referenceSchemaForSeed = {
  brands,
  equipmentCategories,
  equipmentGroups
}

function createSlugMap(definitions: {
  name: string;
  slug: string;
}[]) {
  return new Map(definitions.map((definition) => [
    definition.name,
    definition.slug
  ]))
}

function getRequiredMapValue<ValueType>(
  lookup: Map<string, ValueType>,
  key: string,
  message: string
) {
  const value = lookup.get(key)

  if (value === undefined) {
    throw new Error(message)
  }

  return value
}

async function seedCatalog(db: Database) {
  assertSampleItemCoverage()

  await reset(db, catalogSchemaForReset)

  const groupSlugByName = createSlugMap(groupDefinitions)
  const categorySlugByName = createSlugMap(categoryDefinitions)
  const brandSlugByName = createSlugMap(brandDefinitions)

  await seed(db, referenceSchemaForSeed, {
    seed: referenceSeed
  }).refine((funcs) => {
    return {
      brands: {
        columns: {
          name: funcs.valuesFromArray({
            isUnique: true,
            values: brandDefinitions.map((brand) => brand.name)
          }),
          slug: funcs.valuesFromArray({
            isUnique: true,
            values: brandDefinitions.map((brand) => brand.seedSlug)
          })
        },
        count: brandDefinitions.length
      },

      equipmentCategories: {
        columns: {
          name: funcs.valuesFromArray({
            isUnique: true,
            values: categoryDefinitions.map((category) => category.name)
          }),
          slug: funcs.valuesFromArray({
            isUnique: true,
            values: categoryDefinitions.map((category) => category.seedSlug)
          })
        },
        count: categoryDefinitions.length
      },

      equipmentGroups: {
        columns: {
          name: funcs.valuesFromArray({
            isUnique: true,
            values: groupDefinitions.map((group) => group.name)
          }),
          slug: funcs.valuesFromArray({
            isUnique: true,
            values: groupDefinitions.map((group) => group.seedSlug)
          })
        },
        count: groupDefinitions.length
      }
    }
  })

  await db.transaction(async (tx) => {
    const groupRows = await tx.select({
      id: equipmentGroups.id,
      name: equipmentGroups.name
    }).from(equipmentGroups)

    await Promise.all(groupRows.map((group) =>
      tx
        .update(equipmentGroups)
        .set({
          slug: getRequiredMapValue(
            groupSlugByName,
            group.name,
            `Missing group slug for ${group.name}`
          )
        })
        .where(eq(equipmentGroups.id, group.id))
    ))

    const categoryRows = await tx.select({
      id: equipmentCategories.id,
      name: equipmentCategories.name
    }).from(equipmentCategories)

    await Promise.all(categoryRows.map((category) =>
      tx
        .update(equipmentCategories)
        .set({
          slug: getRequiredMapValue(
            categorySlugByName,
            category.name,
            `Missing category slug for ${category.name}`
          )
        })
        .where(eq(equipmentCategories.id, category.id))
    ))

    const brandRows = await tx.select({
      id: brands.id,
      name: brands.name
    }).from(brands)

    await Promise.all(brandRows.map((brand) =>
      tx
        .update(brands)
        .set({
          slug: getRequiredMapValue(
            brandSlugByName,
            brand.name,
            `Missing brand slug for ${brand.name}`
          )
        })
        .where(eq(brands.id, brand.id))
    ))

    const categories = await tx.select({
      id: equipmentCategories.id,
      slug: equipmentCategories.slug
    }).from(equipmentCategories)

    const brandsList = await tx.select({
      id: brands.id,
      slug: brands.slug
    }).from(brands)

    const categoryIdBySlug = new Map(
      categories.map((category) => [category.slug, category.id])
    )

    const brandIdBySlug = new Map(
      brandsList.map((brand) => [brand.slug, brand.id])
    )

    const propertyRows = Object.entries(propertyDefinitionsByCategorySlug).flatMap(([categorySlug, properties]) => {
      const categoryId = getRequiredMapValue(
        categoryIdBySlug,
        categorySlug,
        `Missing category ${categorySlug}`
      )

      return properties.map((property) => {
        return {
          categoryId,
          dataType: property.dataType,
          name: property.name,
          slug: property.slug,
          unit: property.unit ?? null
        }
      })
    })

    await tx.insert(categoryProperties).values(propertyRows)

    const insertedProperties = await tx.select({
      categoryId: categoryProperties.categoryId,
      id: categoryProperties.id,
      slug: categoryProperties.slug
    }).from(categoryProperties)

    const propertyIdByKey = new Map(
      insertedProperties.map((property) => [`${property.categoryId}:${property.slug}`, property.id])
    )

    const enumOptionRows = Object.entries(propertyDefinitionsByCategorySlug).flatMap(([categorySlug, properties]) => {
      const categoryId = getRequiredMapValue(
        categoryIdBySlug,
        categorySlug,
        `Missing category ${categorySlug}`
      )

      return properties.flatMap((property) => {
        if (property.enumOptions === undefined) {
          return []
        }

        const propertyId = getRequiredMapValue(
          propertyIdByKey,
          `${categoryId}:${property.slug}`,
          `Missing property ${property.slug} for category ${categorySlug}`
        )

        return property.enumOptions.map((option) => {
          return {
            name: option.name,
            propertyId,
            slug: option.slug
          }
        })
      })
    })

    if (enumOptionRows.length > 0) {
      await tx.insert(propertyEnumOptions).values(enumOptionRows)
    }

    const itemRows = sampleItems.map((item) => {
      return {
        brandId: getRequiredMapValue(
          brandIdBySlug,
          item.brandSlug,
          `Missing brand ${item.brandSlug}`
        ),
        categoryId: getRequiredMapValue(
          categoryIdBySlug,
          item.categorySlug,
          `Missing category ${item.categorySlug}`
        ),
        createdBy: null,
        name: item.name,
        status: 'approved'
      }
    })

    const insertedItems = await tx
      .insert(equipmentItems)
      .values(itemRows)
      .returning({
        brandId: equipmentItems.brandId,
        categoryId: equipmentItems.categoryId,
        id: equipmentItems.id,
        name: equipmentItems.name
      })

    const itemIdByKey = new Map(
      insertedItems.map((item) => [`${item.categoryId}:${item.brandId}:${item.name}`, item.id])
    )

    const propertyValueRows = sampleItems.flatMap((item) => {
      const categoryId = getRequiredMapValue(
        categoryIdBySlug,
        item.categorySlug,
        `Missing category ${item.categorySlug}`
      )

      const brandId = getRequiredMapValue(
        brandIdBySlug,
        item.brandSlug,
        `Missing brand ${item.brandSlug}`
      )

      const itemId = getRequiredMapValue(
        itemIdByKey,
        `${categoryId}:${brandId}:${item.name}`,
        `Missing item ${item.name}`
      )

      return item.properties.map((property) => {
        const propertyId = getRequiredMapValue(
          propertyIdByKey,
          `${categoryId}:${property.propertySlug}`,
          `Missing property ${property.propertySlug} for item ${item.name}`
        )

        return {
          itemId,
          propertyId,
          valueBoolean: property.valueBoolean,
          valueNumber: property.valueNumber,
          valueText: property.valueText
        }
      })
    })

    await tx.insert(itemPropertyValues).values(propertyValueRows)
  })
}

export {
  seedCatalog
}
