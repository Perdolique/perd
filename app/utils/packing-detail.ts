import type { PackingListEntry } from '~/types/packing'

interface FetchStatusError {
  response?: FetchStatusResponse;
  status?: number;
  statusCode?: number;
}

interface FetchStatusResponse {
  status?: number;
}

function getEntryDisplayName(entry: PackingListEntry) {
  if (entry.source === 'inventory' && entry.inventory !== undefined) {
    return entry.inventory.itemName
  }

  return entry.customName ?? ''
}

function getEntryDetailText(entry: PackingListEntry) {
  if (entry.source === 'inventory' && entry.inventory !== undefined) {
    return `My gear · ${entry.inventory.brand} · ${entry.inventory.category}`
  }

  return 'Custom item'
}

function normalizeDateString(value: Date | string) {
  if (typeof value === 'string') {
    return value
  }

  return value.toISOString()
}

function normalizePackingListEntry(entry: PackingListEntry): PackingListEntry {
  const createdAt = normalizeDateString(entry.createdAt)
  const updatedAt = normalizeDateString(entry.updatedAt)

  if (entry.inventory === undefined) {
    return {
      createdAt,
      customName: entry.customName,
      id: entry.id,
      isPacked: entry.isPacked,
      source: entry.source,
      updatedAt
    }
  }

  return {
    createdAt,
    customName: entry.customName,
    id: entry.id,

    inventory: {
      brand: entry.inventory.brand,
      category: entry.inventory.category,
      inventoryId: entry.inventory.inventoryId,
      itemName: entry.inventory.itemName
    },

    isPacked: entry.isPacked,
    source: entry.source,
    updatedAt
  }
}

function getErrorStatusCode(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const fetchError = error as FetchStatusError

  return fetchError.statusCode ?? fetchError.status ?? fetchError.response?.status
}

export {
  getEntryDetailText,
  getEntryDisplayName,
  getErrorStatusCode,
  normalizeDateString,
  normalizePackingListEntry
}
