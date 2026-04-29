interface CatalogEntitySummary {
  name: string;
  slug: string;
}

interface CatalogEntityDetail extends CatalogEntitySummary {
  id: number;
}

interface CatalogListItem {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  id: string;
  name: string;
}

interface CatalogListItemView {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  detailPath: string;
  id: string;
  name: string;
}

interface CatalogItemsResponse {
  items: CatalogListItem[];
  limit: number;
  page: number;
  total: number;
}

interface ItemProperty {
  dataType: string;
  name: string;
  slug: string;
  unit: string | null;
  value: string | null;
}

interface ItemDetailResponse {
  brand: CatalogEntityDetail;
  category: CatalogEntityDetail;
  createdAt: string;
  id: string;
  name: string;
  properties: ItemProperty[];
  status: string;
}

interface ItemDisplayProperty extends ItemProperty {
  displayValue: string;
}

interface InventoryItem {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  id: string;
  name: string;
}

interface InventoryRecord {
  createdAt: string;
  id: string;
  item: InventoryItem;
}

interface InventoryRecordView {
  catalogPath: string;
  createdAt: string;
  formattedCreatedAt: string;
  id: string;
  isRemoveDisabled: boolean;
  isRemoving: boolean;
  item: InventoryItem;
}

export type {
  CatalogEntityDetail,
  CatalogEntitySummary,
  CatalogItemsResponse,
  CatalogListItem,
  CatalogListItemView,
  InventoryItem,
  InventoryRecord,
  InventoryRecordView,
  ItemDetailResponse,
  ItemDisplayProperty,
  ItemProperty
}
