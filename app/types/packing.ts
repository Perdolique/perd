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

interface PackingListEntry {
  createdAt: string;
  customName: string | null;
  id: string;
  inventory?: PackingListEntryInventory;
  isPacked: boolean;
  source: 'custom' | 'inventory';
  updatedAt: string;
}

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

export type {
  PackingListDetail,
  PackingListEntry,
  PackingListEntryInventory,
  PackingListSummary,
  PackingListView
}
