interface PackingListSummary {
  createdAt: string;
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
