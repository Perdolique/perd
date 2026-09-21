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

export {
  countPackedEntries,
  formatPackingProgress,
  latestPackingListUpdatedAt,
  normalizePackingListSummary,
  packingListDateFormatter
}
