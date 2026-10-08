import { createError } from 'nuxt/server'

interface PackingListInventoryBase {
  inventoryId: string;
  itemName: string;
}

interface PackingListCatalogInventory extends PackingListInventoryBase {
  brand: string;
  category: string;
  source: 'catalog';
}

interface PackingListCustomInventory extends PackingListInventoryBase {
  source: 'custom';
}

type PackingListEntryInventory = PackingListCatalogInventory | PackingListCustomInventory

interface PackingListInventoryRow {
  brand: string | null;
  category: string | null;
  customName: string | null;
  inventoryId: string;
  itemName: string | null;
}

interface PackingListEntryBase {
  createdAt: Date | string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  updatedAt: Date | string;
}

interface PackingListCustomEntry extends PackingListEntryBase {
  source: 'custom';
}

interface PackingListInventoryEntry extends PackingListEntryBase {
  inventory: PackingListEntryInventory;
  source: 'inventory';
}

type PackingListEntry = PackingListCustomEntry | PackingListInventoryEntry

interface PackingListEntryMutationResponse {
  entry: PackingListEntry;
  packingListUpdatedAt: Date | string;
}

/** Shapes saved gear consistently for list reads, selection, and entry mutations. */
function createPackingListInventory(row: PackingListInventoryRow): PackingListEntryInventory {
  if (row.customName !== null) {
    return {
      inventoryId: row.inventoryId,
      itemName: row.customName,
      source: 'custom'
    }
  }

  const { brand, category, itemName } = row
  const hasInvalidCatalogSource = itemName === null || brand === null || category === null

  if (hasInvalidCatalogSource) {
    console.error('Invalid packing list inventory source', row)

    throw createError({
      status: 500,
      message: 'Could not load saved gear'
    })
  }

  return {
    brand,
    category,
    inventoryId: row.inventoryId,
    itemName,
    source: 'catalog'
  }
}

function createPackingListEntry(
  entry: PackingListEntryBase,
  inventory: PackingListEntryInventory | null
): PackingListEntry {
  const base: PackingListEntryBase = {
    createdAt: entry.createdAt,
    customName: entry.customName,
    id: entry.id,
    isPacked: entry.isPacked,
    updatedAt: entry.updatedAt
  }

  if (inventory === null) {
    return {
      ...base,
      source: 'custom'
    }
  }

  return {
    ...base,
    inventory,
    source: 'inventory'
  }
}

export { createPackingListEntry, createPackingListInventory }

export type {
  PackingListEntry,
  PackingListEntryInventory,
  PackingListEntryMutationResponse,
  PackingListInventoryRow
}
