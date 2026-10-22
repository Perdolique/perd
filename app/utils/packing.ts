import { limits } from '#shared/constants'
import { compareDecimalNumbers, normalizeDecimalNumber } from '#shared/utils/decimal-number'
import type { PackingListEntry, PackingListSummary, PackingListWeightSummary } from '~/types/packing'

interface PackingListSummaryInput {
  createdAt: Date | string;
  entryCount: number;
  id: string;
  name: string;
  packedCount: number;
  updatedAt: Date | string;
}

const packingListDateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium'
})

function formatPackingProgress(packedCount: number, entryCount: number) {
  if (entryCount === 0) {
    return '0 items'
  }

  const progress = `${packedCount} of ${entryCount} packed`

  return packedCount === entryCount ? `${progress} · All packed` : progress
}

function latestPackingListUpdatedAt(current: string, incoming: Date | string) {
  const next = String(incoming)

  return current === '' || Date.parse(next) > Date.parse(current) ? next : current
}

function normalizePackingListSummary(summary: PackingListSummaryInput): PackingListSummary {
  return {
    createdAt: String(summary.createdAt),
    entryCount: summary.entryCount,
    id: summary.id,
    name: summary.name,
    packedCount: summary.packedCount,
    updatedAt: String(summary.updatedAt)
  }
}

function countPackedEntries(entries: PackingListEntry[]) {
  return entries.filter((entry) => entry.isPacked).length
}

/** Keeps the copy suffix within the existing UTF-16 name limit without splitting code points. */
function packingListCopyName(name: string) {
  const suffix = ' — copy'
  const availableLength = limits.maxPackingListNameLength - suffix.length
  let original = ''

  for (const character of name) {
    if (original.length + character.length > availableLength) {
      break
    }

    original += character
  }

  const copyName = `${original}${suffix}`

  return copyName
}

/** Labels per-item weight without rounding the saved decimal string. */
function formatPackingEntryWeight(entry: Pick<PackingListEntry, 'weightGrams' | 'weightSource'>) {
  if (entry.weightGrams === null) {
    return 'Weight unknown'
  }

  const sources = {
    measured: 'Measured',
    catalog: 'Catalog',
    custom: 'Custom'
  }

  const source = entry.weightSource === null ? '' : ` · ${sources[entry.weightSource]}`

  return `${entry.weightGrams} g per item${source}`
}

function formatScaledDecimal(value: bigint, scale: number) {
  const digits = value.toString().padStart(scale + 1, '0')

  if (scale === 0) {
    return digits
  }

  const integerPart = digits.slice(0, -scale)
  const fractionPart = digits.slice(-scale)
  const decimal = `${integerPart}.${fractionPart}`

  return normalizeDecimalNumber(decimal)
}

/** Sums resolved per-item weights without rounding decimal inputs or intermediate products. */
function calculatePackingListWeight(entries: Pick<PackingListEntry, 'quantity' | 'weightGrams'>[]): PackingListWeightSummary {
  let total = 0n
  let scale = 0
  let knownEntryCount = 0
  let unknownEntryCount = 0

  for (const entry of entries) {
    if (entry.weightGrams === null) {
      unknownEntryCount += 1
    } else {
      const weight = normalizeDecimalNumber(entry.weightGrams)
      const [integerPart = '0', fractionPart = ''] = weight.split('.')
      const digits = `${integerPart}${fractionPart}`
      const coefficient = BigInt(digits)
      const quantity = BigInt(entry.quantity)
      const entryWeight = coefficient * quantity
      const nextScale = Math.max(scale, fractionPart.length)
      const totalMultiplier = 10n ** BigInt(nextScale - scale)
      const entryMultiplier = 10n ** BigInt(nextScale - fractionPart.length)

      total = total * totalMultiplier + entryWeight * entryMultiplier
      scale = nextScale
      knownEntryCount += 1
    }
  }

  const knownWeightGrams = formatScaledDecimal(total, scale)

  return {
    knownWeightGrams,
    knownEntryCount,
    unknownEntryCount
  }
}

/** Chooses the unit before rounding; positive sub-milligram values never appear as zero. */
function formatPackingListWeight(weightGrams: string) {
  const weight = normalizeDecimalNumber(weightGrams)
  const isPositive = compareDecimalNumbers(weight, '0') > 0
  const isBelowDisplayPrecision = compareDecimalNumbers(weight, '0.001') < 0

  if (isPositive && isBelowDisplayPrecision) {
    return '<0.001 g'
  }

  const isKilograms = compareDecimalNumbers(weight, '1000') >= 0
  const unit = isKilograms ? 'kg' : 'g'
  const [integerPart = '0', fractionPart = ''] = weight.split('.')
  const digits = `${integerPart}${fractionPart}`
  const coefficient = BigInt(digits)
  const scale = fractionPart.length + (isKilograms ? 3 : 0)

  if (scale <= 3) {
    const formattedWeight = formatScaledDecimal(coefficient, scale)

    return `${formattedWeight} ${unit}`
  }

  const divisor = 10n ** BigInt(scale - 3)
  const roundedWeight = (coefficient + divisor / 2n) / divisor
  const formattedWeight = formatScaledDecimal(roundedWeight, 3)

  return `${formattedWeight} ${unit}`
}

export {
  calculatePackingListWeight,
  formatPackingEntryWeight,
  formatPackingListWeight,
  packingListCopyName,
  countPackedEntries,
  formatPackingProgress,
  latestPackingListUpdatedAt,
  normalizePackingListSummary,
  packingListDateFormatter
}
