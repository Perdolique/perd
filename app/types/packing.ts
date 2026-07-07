interface PackingListSummary {
  createdAt: string;
  entryCount: number;
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListEntryInventory {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
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
  formattedUpdatedAt: string;
}

interface PackingListEntryView {
  id: string;
  isPacked: boolean;
  packedStatusText: string;
  sourceText: string;
  subtitle: string;
  title: string;
}

export type {
  PackingListDetail,
  PackingListEntry,
  PackingListCustomEntry,
  PackingListEntryInventory,
  PackingListInventoryEntry,
  PackingListEntryView,
  PackingListSummary,
  PackingListView
}
