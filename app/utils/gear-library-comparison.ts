import type { LocationQueryValue } from 'vue-router'

interface GearLibraryComparisonNormalization {
  ids: string[];
  hasDuplicateIds: boolean;
  hasInvalidIds: boolean;
  hasOverLimitIds: boolean;
  wasClearedForMissingCategory: boolean;
}

const maximumGearLibraryComparisonItems = 4
const canonicalUuidV7Pattern = /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u

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

export type { GearLibraryComparisonNormalization }

export {
  maximumGearLibraryComparisonItems,
  normalizeGearLibraryComparisonQuery
}
