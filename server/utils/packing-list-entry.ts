import { createError } from 'nuxt/server'
import type { MyGearRecord } from '#server/utils/my-gear'
import { normalizeDecimalNumber } from '#shared/utils/decimal-number'

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
  personalName: string | null;
}

interface PackingListEntryWeight {
  weightGrams: string | null;
  weightSource: 'measured' | 'catalog' | 'custom' | null;
}

interface PackingListEntryBase {
  createdAt: Date | string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  quantity: number;
  customWeightGrams: string | null;
  updatedAt: Date | string;
}

type PackingListEntryResponseBase = Omit<PackingListEntryBase, 'customWeightGrams'> & PackingListEntryWeight

interface PackingListCustomEntry extends PackingListEntryResponseBase {
  source: 'custom';
}

interface PackingListInventoryEntry extends PackingListEntryResponseBase {
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
    itemName: row.personalName ?? itemName,
    source: 'catalog'
  }
}

/** Resolves live saved-gear weight or the weight owned by a free-text entry. */
function resolvePackingListWeight(customWeightGrams: string | null, gear: MyGearRecord | null): PackingListEntryWeight {
  if (gear === null) {
    return {
      weightGrams: customWeightGrams === null ? null : normalizeDecimalNumber(customWeightGrams),
      weightSource: customWeightGrams === null ? null : 'custom'
    }
  }

  if (gear.measuredWeightGrams !== null) {
    return {
      weightGrams: gear.measuredWeightGrams,
      weightSource: 'measured'
    }
  }

  if (gear.source === 'catalog' && gear.item.weightGrams !== null) {
    return {
      weightGrams: gear.item.weightGrams,
      weightSource: 'catalog'
    }
  }

  return {
    weightGrams: null,
    weightSource: null
  }
}

function createPackingListEntry(
  entry: PackingListEntryBase,
  inventory: PackingListEntryInventory | null,
  gear: MyGearRecord | null
): PackingListEntry {
  const base: PackingListEntryResponseBase = {
    createdAt: entry.createdAt,
    customName: entry.customName,
    id: entry.id,
    isPacked: entry.isPacked,
    quantity: entry.quantity,
    ...resolvePackingListWeight(entry.customWeightGrams, gear),
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
