interface CatalogEntitySummary {
  name: string;
  slug: string;
}

interface CatalogEntityDetail extends CatalogEntitySummary {
  id: number;
}

interface CategoryPropertyEnumOption {
  id: number;
  name: string;
  slug: string;
}

interface CategoryPropertyDetail {
  dataType: string;
  enumOptions?: CategoryPropertyEnumOption[];
  id: number;
  name: string;
  slug: string;
  unit: string | null;
}

interface CategoryDetailResponse extends CatalogEntityDetail {
  properties: CategoryPropertyDetail[];
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

interface ItemSubmissionPropertyInput {
  propertyId: number;
  value: boolean | string;
}

interface ItemSubmissionCreateBody {
  brandId: number;
  categoryId: number;
  name: string;
  properties: ItemSubmissionPropertyInput[];
}

interface SubmittedCatalogItem {
  brand: CatalogEntitySummary;
  category: CatalogEntitySummary;
  createdAt: string;
  id: string;
  name: string;
  properties: ItemProperty[];
  status: string;
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

interface ItemSubmissionCreateResponse {
  inventory: InventoryRecord;
  item: SubmittedCatalogItem;
}

export type {
  CategoryDetailResponse,
  CategoryPropertyDetail,
  CategoryPropertyEnumOption,
  CatalogEntityDetail,
  CatalogEntitySummary,
  CatalogItemsResponse,
  CatalogListItem,
  CatalogListItemView,
  InventoryItem,
  InventoryRecord,
  InventoryRecordView,
  ItemSubmissionCreateBody,
  ItemSubmissionCreateResponse,
  ItemSubmissionPropertyInput,
  ItemDetailResponse,
  ItemDisplayProperty,
  ItemProperty,
  SubmittedCatalogItem
}
