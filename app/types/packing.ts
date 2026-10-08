import type { PackingListEntryInventory } from '#server/utils/packing-list-entry'

interface PackingListSummary {
  createdAt: string;
  entryCount: number;
  id: string;
  name: string;
  packedCount: number;
  updatedAt: string;
}

type PackingListAvailableGearItem = PackingListEntryInventory

type PackingListEntryCreateBody = {
  customName: string;
} | {
  inventoryId: string;
}

interface PackingListEntryUpdateOptions {
  entryId: string;
  isPacked: boolean;
  packingListId: string;
  previousIsPacked: boolean;
}

interface PackingListEntryBase {
  createdAt: string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  updatedAt: string;
}

interface PackingListCustomEntry extends PackingListEntryBase {
  source: 'custom';
}

interface PackingListInventoryEntry extends PackingListEntryBase {
  inventory: PackingListEntryInventory;
  source: 'inventory';
}

type PackingListEntry = PackingListCustomEntry | PackingListInventoryEntry

interface PackingListDetail {
  createdAt: string;
  entries: PackingListEntry[];
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListView extends PackingListSummary {
  isPackedUnconfirmed?: boolean;
  formattedUpdatedAt: string;
}

interface PackingListEntryView {
  hasPackError: boolean;
  id: string;
  isPacked: boolean;
  isPackDisabled: boolean;
  isPackFocusTarget: boolean;
  isPacking: boolean;
  isRemoveDisabled: boolean;
  isRemoving: boolean;
  subtitle: string;
  title: string;
}

export type {
  PackingListAvailableGearItem,
  PackingListDetail,
  PackingListEntry,
  PackingListEntryCreateBody,
  PackingListCustomEntry,
  PackingListEntryUpdateOptions,
  PackingListInventoryEntry,
  PackingListEntryView,
  PackingListSummary,
  PackingListView
}

export type { PackingListEntryInventory } from '#server/utils/packing-list-entry'
