import type { LocationQueryValue } from 'vue-router'
import type { ComparisonResponse } from '#server/api/equipment/comparisons.get'

type ComparisonProperty = ComparisonResponse['properties'][number]
type ComparisonPropertyValue = ComparisonProperty['values'][number]

interface GearLibraryComparisonValidation {
  ids: string[];
  hasDuplicateIds: boolean;
  hasInsufficientIds: boolean;
  hasInvalidIds: boolean;
  hasOverLimitIds: boolean;
  isValid: boolean;
}

interface GearLibraryComparisonDisplayValue {
  displayValue: string;
  itemId: string;
  rawValue: ComparisonPropertyValue['value'];
}

interface GearLibraryComparisonRow {
  id: number;
  name: string;
  slug: string;
  values: GearLibraryComparisonDisplayValue[];
}

interface GearLibraryComparisonNormalization {
  ids: string[];
  hasDuplicateIds: boolean;
  hasInvalidIds: boolean;
  hasOverLimitIds: boolean;
  wasClearedForMissingCategory: boolean;
}

const maximumGearLibraryComparisonItems = 4
const minimumGearLibraryComparisonItems = 2
const canonicalUuidV7Pattern = /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u

/** Validates a comparison-page query without correcting or dropping bad values. */
function validateGearLibraryComparisonQuery(
  value?: LocationQueryValue | LocationQueryValue[]
): GearLibraryComparisonValidation {
  const values: LocationQueryValue[] = []

  if (Array.isArray(value)) {
    values.push(...value)
  } else if (value !== undefined) {
    values.push(value)
  }

  const ids: string[] = []
  const uniqueIds = new Set<string>()
  let hasDuplicateIds = false
  let hasInvalidIds = false

  for (const queryValue of values) {
    const isValidId = typeof queryValue === 'string'
      && canonicalUuidV7Pattern.test(queryValue)

    if (isValidId) {
      ids.push(queryValue)

      if (uniqueIds.has(queryValue)) {
        hasDuplicateIds = true
      } else {
        uniqueIds.add(queryValue)
      }
    } else {
      hasInvalidIds = true
    }
  }

  const hasInsufficientIds = values.length < minimumGearLibraryComparisonItems
  const hasOverLimitIds = values.length > maximumGearLibraryComparisonItems

  const isValid = hasDuplicateIds === false
    && hasInsufficientIds === false
    && hasInvalidIds === false
    && hasOverLimitIds === false

  return {
    ids,
    hasDuplicateIds,
    hasInsufficientIds,
    hasInvalidIds,
    hasOverLimitIds,
    isValid
  }
}

/** Compares stored typed values before any display formatting. */
function areGearLibraryComparisonValuesEqual(
  values: ComparisonPropertyValue['value'][]
) {
  const [firstValue, ...remainingValues] = values

  return remainingValues.every((value) => value === firstValue)
}

/** Formats one typed comparison value for the matrix. */
function formatGearLibraryComparisonValue(
  property: Pick<ComparisonProperty, 'dataType' | 'unit'>,
  propertyValue: ComparisonPropertyValue
) {
  const { value } = propertyValue

  if (value === null) {
    return '—'
  }

  if (property.dataType === 'boolean') {
    return value === true ? 'Yes' : 'No'
  }

  if (property.dataType === 'enum' && typeof value === 'string') {
    return propertyValue.enumOptionName ?? value
  }

  if (property.dataType === 'number' && property.unit !== null) {
    return `${value} ${property.unit}`
  }

  return String(value)
}

/** Projects API properties into ordered rows for the currently visible item columns. */
function createGearLibraryComparisonRows(
  properties: ComparisonProperty[],
  visibleItemIds: string[],
  differencesOnly: boolean
): GearLibraryComparisonRow[] {
  const rows: GearLibraryComparisonRow[] = []

  for (const property of properties) {
    const valuesByItemId = new Map(
      property.values.map((propertyValue) => [propertyValue.itemId, propertyValue])
    )

    const visibleValues: ComparisonPropertyValue[] = visibleItemIds.map(
      (itemId) => valuesByItemId.get(itemId) ?? {
        itemId,
        value: null
      }
    )

    const rawValues = visibleValues.map((propertyValue) => propertyValue.value)
    const hasEqualValues = areGearLibraryComparisonValuesEqual(rawValues)
    const shouldIncludeRow = differencesOnly === false || hasEqualValues === false

    if (shouldIncludeRow) {
      const values = visibleValues.map((propertyValue) => {
        const displayValue = formatGearLibraryComparisonValue(property, propertyValue)

        return {
          displayValue,
          itemId: propertyValue.itemId,
          rawValue: propertyValue.value
        }
      })

      rows.push({
        id: property.id,
        name: property.name,
        slug: property.slug,
        values
      })
    }
  }

  return rows
}

/** Normalizes ordered catalog comparison IDs and records every user-visible adjustment reason. */
function normalizeGearLibraryComparisonQuery(
  value?: LocationQueryValue | LocationQueryValue[],
  category?: string
): GearLibraryComparisonNormalization {
  const hasComparisonQuery = value !== undefined

  if (hasComparisonQuery === false) {
    return {
      ids: [],
      hasDuplicateIds: false,
      hasInvalidIds: false,
      hasOverLimitIds: false,
      wasClearedForMissingCategory: false
    }
  }

  if (category === undefined) {
    return {
      ids: [],
      hasDuplicateIds: false,
      hasInvalidIds: false,
      hasOverLimitIds: false,
      wasClearedForMissingCategory: true
    }
  }

  const values = Array.isArray(value) ? value : [value]
  const uniqueIds = new Set<string>()
  const ids: string[] = []
  let hasDuplicateIds = false
  let hasInvalidIds = false
  let hasOverLimitIds = false

  for (const queryValue of values) {
    const isValidId = typeof queryValue === 'string'
      && canonicalUuidV7Pattern.test(queryValue)

    if (isValidId === false) {
      hasInvalidIds = true
    } else if (uniqueIds.has(queryValue)) {
      hasDuplicateIds = true
    } else {
      uniqueIds.add(queryValue)

      if (ids.length === maximumGearLibraryComparisonItems) {
        hasOverLimitIds = true
      } else {
        ids.push(queryValue)
      }
    }
  }

  return {
    ids,
    hasDuplicateIds,
    hasInvalidIds,
    hasOverLimitIds,
    wasClearedForMissingCategory: false
  }
}

export {
  areGearLibraryComparisonValuesEqual,
  createGearLibraryComparisonRows,
  formatGearLibraryComparisonValue,
  maximumGearLibraryComparisonItems,
  minimumGearLibraryComparisonItems,
  normalizeGearLibraryComparisonQuery,
  validateGearLibraryComparisonQuery
}

export type {
  GearLibraryComparisonDisplayValue,
  GearLibraryComparisonNormalization,
  GearLibraryComparisonRow,
  GearLibraryComparisonValidation
}
