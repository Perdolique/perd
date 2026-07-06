interface PackingListSummary {
  createdAt: string;
  entryCount: number;
  id: string;
  name: string;
  updatedAt: string;
}

interface PackingListView extends PackingListSummary {
  formattedUpdatedAt: string;
}

export type {
  PackingListSummary,
  PackingListView
}
