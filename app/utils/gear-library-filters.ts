import type { GearLibraryRouteState } from '~/utils/gear-library'
import { compareDecimalNumbers, isFiniteDecimalNumber, normalizeDecimalNumber } from '#shared/utils/decimal-number'

type GearLibraryBooleanDraftValue = 'any' | 'false' | 'true'
type GearLibraryAppliedFilterKind = 'boolean' | 'brand' | 'enum' | 'number'

interface GearLibraryNumberRangeDraft {
  max: string;
  min: string;
}

interface GearLibraryFilterDraft {
  boolean: Record<string, GearLibraryBooleanDraftValue>;
  brand: string[];
  enum: Record<string, string[]>;
  number: Record<string, GearLibraryNumberRangeDraft>;
}

interface GearLibraryAppliedFilters {
  boolean: string[];
  brand: string[];
  enum: string[];
  number: string[];
}

interface GearLibraryAppliedFilter {
  kind: GearLibraryAppliedFilterKind;
  value: string;
}

interface GearLibraryAppliedFilterChip extends GearLibraryAppliedFilter {
  id: string;
  label: string;
  removeLabel: string;
}

interface GearLibraryFilterEnumOptionMetadata {
  name: string;
  slug: string;
}

interface GearLibraryFilterPropertyMetadata {
  enumOptions?: GearLibraryFilterEnumOptionMetadata[];
  name: string;
  slug: string;
  unit: string | null;
}

interface GearLibraryFilterMetadata {
  brands: GearLibraryFilterEnumOptionMetadata[];
  properties: GearLibraryFilterPropertyMetadata[];
}

type GearLibraryNumberRangeErrors = Partial<Record<string, string>>

const filterKinds = ['brand', 'number', 'enum', 'boolean'] as const

function createEmptyRecord<TValue>(): Record<string, TValue> {
  // Object.create has no generic overload for a null-prototype dictionary.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.create(null) as Record<string, TValue>
}

function createEmptyGearLibraryFilterDraft(): GearLibraryFilterDraft {
  return {
    boolean: createEmptyRecord<GearLibraryBooleanDraftValue>(),
    brand: [],
    enum: createEmptyRecord<string[]>(),
    number: createEmptyRecord<GearLibraryNumberRangeDraft>()
  }
}

function createEmptyGearLibraryAppliedFilters(): GearLibraryAppliedFilters {
  return {
    boolean: [],
    brand: [],
    enum: [],
    number: []
  }
}

function getGearLibraryAppliedFilters(
  routeState: Pick<GearLibraryRouteState, 'boolean' | 'brand' | 'enum' | 'number'>
): GearLibraryAppliedFilters {
  return {
    boolean: [...routeState.boolean],
    brand: [...routeState.brand],
    enum: [...routeState.enum],
    number: [...routeState.number]
  }
}

function parseNumberFilter(value: string) {
  const parts = value.split(':')

  if (parts.length !== 3) {
    return
  }

  const [propertySlug, min, max] = parts

  if (propertySlug === undefined || propertySlug === '' || min === undefined || max === undefined) {
    return
  }

  return {
    max,
    min,
    propertySlug
  }
}

function parsePropertyValueFilter(value: string) {
  const separatorIndex = value.indexOf(':')

  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return
  }

  return {
    propertySlug: value.slice(0, separatorIndex),
    value: value.slice(separatorIndex + 1)
  }
}

function createGearLibraryFilterDraft(filters: GearLibraryAppliedFilters): GearLibraryFilterDraft {
  const draft = createEmptyGearLibraryFilterDraft()

  draft.brand = [...filters.brand]

  for (const filter of filters.number) {
    const parsedFilter = parseNumberFilter(filter)

    if (parsedFilter !== undefined && draft.number[parsedFilter.propertySlug] === undefined) {
      draft.number[parsedFilter.propertySlug] = {
        max: parsedFilter.max,
        min: parsedFilter.min
      }
    }
  }

  for (const filter of filters.enum) {
    const parsedFilter = parsePropertyValueFilter(filter)

    if (parsedFilter !== undefined) {
      const selectedOptions = draft.enum[parsedFilter.propertySlug] ?? []

      selectedOptions.push(parsedFilter.value)
      draft.enum[parsedFilter.propertySlug] = selectedOptions
    }
  }

  for (const filter of filters.boolean) {
    const parsedFilter = parsePropertyValueFilter(filter)

    if (parsedFilter !== undefined && (parsedFilter.value === 'false' || parsedFilter.value === 'true')) {
      draft.boolean[parsedFilter.propertySlug] = parsedFilter.value
    }
  }

  return draft
}

function getGearLibraryNumberRangeErrors(draft: GearLibraryFilterDraft): GearLibraryNumberRangeErrors {
  const errors: GearLibraryNumberRangeErrors = createEmptyRecord<string>()

  for (const [propertySlug, range] of Object.entries(draft.number)) {
    const min = range.min.trim()
    const max = range.max.trim()
    const hasInvalidMin = min !== '' && isFiniteDecimalNumber(min) === false
    const hasInvalidMax = max !== '' && isFiniteDecimalNumber(max) === false
    const hasBothBounds = min !== '' && max !== ''
    const hasValidBounds = hasInvalidMin === false && hasInvalidMax === false
    const hasReversedRange = hasBothBounds && hasValidBounds
      && compareDecimalNumbers(min, max) > 0

    if (hasInvalidMin || hasInvalidMax) {
      errors[propertySlug] = 'Enter valid numbers.'
    } else if (hasReversedRange) {
      errors[propertySlug] = 'Minimum must not exceed maximum.'
    }
  }

  return errors
}

function normalizeGearLibraryFilterDraft(draft: GearLibraryFilterDraft): GearLibraryAppliedFilters {
  const filters = createEmptyGearLibraryAppliedFilters()
  const uniqueBrands = new Set(draft.brand)

  filters.brand = [...uniqueBrands].toSorted((left, right) => left.localeCompare(right))

  const sortedNumberEntries = Object.entries(draft.number).toSorted(
    ([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug)
  )

  for (const [propertySlug, range] of sortedNumberEntries) {
    const min = range.min.trim()
    const max = range.max.trim()

    if (min !== '' || max !== '') {
      const normalizedMin = min === '' ? '' : normalizeDecimalNumber(min)
      const normalizedMax = max === '' ? '' : normalizeDecimalNumber(max)

      filters.number.push(`${propertySlug}:${normalizedMin}:${normalizedMax}`)
    }
  }

  const sortedEnumEntries = Object.entries(draft.enum).toSorted(
    ([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug)
  )

  for (const [propertySlug, options] of sortedEnumEntries) {
    const uniqueOptions = new Set(options)

    for (const option of [...uniqueOptions].toSorted((left, right) => left.localeCompare(right))) {
      filters.enum.push(`${propertySlug}:${option}`)
    }
  }

  const sortedBooleanEntries = Object.entries(draft.boolean).toSorted(
    ([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug)
  )

  for (const [propertySlug, value] of sortedBooleanEntries) {
    if (value !== 'any') {
      filters.boolean.push(`${propertySlug}:${value}`)
    }
  }

  return filters
}

function getGearLibraryAppliedFilterCount(filters: GearLibraryAppliedFilters) {
  return filterKinds.reduce((count, kind) => count + filters[kind].length, 0)
}

function removeGearLibraryAppliedFilter(
  filters: GearLibraryAppliedFilters,
  filterToRemove: GearLibraryAppliedFilter
): GearLibraryAppliedFilters {
  const nextFilters = getGearLibraryAppliedFilters(filters)

  nextFilters[filterToRemove.kind] = nextFilters[filterToRemove.kind].filter(
    (value) => value !== filterToRemove.value
  )

  return nextFilters
}

function getMetadataName(
  values: GearLibraryFilterEnumOptionMetadata[],
  slug: string
) {
  return values.find((value) => value.slug === slug)?.name ?? slug
}

function formatNumberFilterLabel(
  rawValue: string,
  metadata: GearLibraryFilterMetadata
) {
  const parsedFilter = parseNumberFilter(rawValue)

  if (parsedFilter === undefined) {
    return `Number: ${rawValue}`
  }

  const property = metadata.properties.find(({ slug }) => slug === parsedFilter.propertySlug)
  const propertyName = property?.name ?? parsedFilter.propertySlug
  const unitSuffix = property?.unit === null || property?.unit === undefined || property.unit === ''
    ? ''
    : ` ${property.unit}`

  if (parsedFilter.min !== '' && parsedFilter.max !== '') {
    return `${propertyName}: ${parsedFilter.min}–${parsedFilter.max}${unitSuffix}`
  }

  if (parsedFilter.min !== '') {
    return `${propertyName}: from ${parsedFilter.min}${unitSuffix}`
  }

  if (parsedFilter.max !== '') {
    return `${propertyName}: up to ${parsedFilter.max}${unitSuffix}`
  }

  return `${propertyName}: any value`
}

function formatPropertyValueFilterLabel(
  kind: 'boolean' | 'enum',
  rawValue: string,
  metadata: GearLibraryFilterMetadata
) {
  const parsedFilter = parsePropertyValueFilter(rawValue)

  if (parsedFilter === undefined) {
    const fallbackPrefix = kind === 'boolean' ? 'Boolean' : 'Option'

    return `${fallbackPrefix}: ${rawValue}`
  }

  const property = metadata.properties.find(({ slug }) => slug === parsedFilter.propertySlug)
  const propertyName = property?.name ?? parsedFilter.propertySlug

  if (kind === 'boolean') {
    let booleanLabel = parsedFilter.value

    if (parsedFilter.value === 'true') {
      booleanLabel = 'Yes'
    } else if (parsedFilter.value === 'false') {
      booleanLabel = 'No'
    }

    return `${propertyName}: ${booleanLabel}`
  }

  const optionName = getMetadataName(property?.enumOptions ?? [], parsedFilter.value)

  return `${propertyName}: ${optionName}`
}

function getAppliedFilterChipLabel(
  kind: GearLibraryAppliedFilterKind,
  value: string,
  metadata: GearLibraryFilterMetadata
) {
  if (kind === 'brand') {
    return `Brand: ${getMetadataName(metadata.brands, value)}`
  }

  if (kind === 'number') {
    return formatNumberFilterLabel(value, metadata)
  }

  return formatPropertyValueFilterLabel(kind, value, metadata)
}

function createGearLibraryAppliedFilterChips(
  filters: GearLibraryAppliedFilters,
  metadata: GearLibraryFilterMetadata
): GearLibraryAppliedFilterChip[] {
  const chips: GearLibraryAppliedFilterChip[] = []

  for (const kind of filterKinds) {
    for (const value of filters[kind]) {
      const label = getAppliedFilterChipLabel(kind, value, metadata)

      chips.push({
        id: `${kind}:${value}`,
        kind,
        label,
        removeLabel: `Remove ${label} filter`,
        value
      })
    }
  }

  return chips
}

export type {
  GearLibraryAppliedFilter,
  GearLibraryAppliedFilterChip,
  GearLibraryAppliedFilters,
  GearLibraryBooleanDraftValue,
  GearLibraryFilterDraft,
  GearLibraryNumberRangeDraft,
  GearLibraryNumberRangeErrors
}

export {
  createEmptyGearLibraryAppliedFilters,
  createEmptyGearLibraryFilterDraft,
  createGearLibraryAppliedFilterChips,
  createGearLibraryFilterDraft,
  getGearLibraryAppliedFilterCount,
  getGearLibraryAppliedFilters,
  getGearLibraryNumberRangeErrors,
  normalizeGearLibraryFilterDraft,
  removeGearLibraryAppliedFilter
}
