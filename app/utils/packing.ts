import { limits } from '#shared/constants'
import type { PackingListEntry, PackingListSummary } from '~/types/packing'

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

export {
  packingListCopyName,
  countPackedEntries,
  formatPackingProgress,
  latestPackingListUpdatedAt,
  normalizePackingListSummary,
  packingListDateFormatter
}
