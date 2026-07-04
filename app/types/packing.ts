interface PackingListSummary {
  createdAt: string;
  entryCount: number;
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListEntryMyGear {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface PackingListEntry {
  createdAt: string;
  customName: string | null;
  id: string;
  inventory?: PackingListEntryMyGear;
  isPacked: boolean;
  source: 'custom' | 'inventory';
  updatedAt: string;
}

interface PackingListEntryView extends PackingListEntry {
  detailText: string;
  displayName: string;
  isDisabled: boolean;
  isLoading: boolean;
  stateClass: 'packed' | 'unpacked';
  stateText: string;
  toggleLabel: string;
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

type PackingListDetailMode = 'planning' | 'checklist'

export type {
  PackingListDetailMode,
  PackingListDetail,
  PackingListEntry,
  PackingListEntryMyGear,
  PackingListEntryView,
  PackingListSummary,
  PackingListView
}
