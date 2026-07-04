interface GearLibraryEntitySummary {
  name: string;
  slug: string;
}

interface GearLibraryEntityDetail extends GearLibraryEntitySummary {
  id: number;
}

interface GearLibraryListItem {
  brand: GearLibraryEntitySummary;
  category: GearLibraryEntitySummary;
  id: string;
  name: string;
}

interface GearLibraryListItemView {
  brand: GearLibraryEntitySummary;
  category: GearLibraryEntitySummary;
  detailPath: string;
  id: string;
  name: string;
}

interface GearLibraryItemsResponse {
  items: GearLibraryListItem[];
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
  brand: GearLibraryEntityDetail;
  category: GearLibraryEntityDetail;
  createdAt: string;
  id: string;
  name: string;
  properties: ItemProperty[];
  status: string;
}

interface ItemDisplayProperty extends ItemProperty {
  displayValue: string;
}

interface MyGearItem {
  brand: GearLibraryEntitySummary;
  category: GearLibraryEntitySummary;
  id: string;
  name: string;
}

interface MyGearRecord {
  createdAt: string;
  id: string;
  item: MyGearItem;
}

interface MyGearRecordView {
  createdAt: string;
  formattedCreatedAt: string;
  gearLibraryPath: string;
  id: string;
  isRemoveDisabled: boolean;
  isRemoving: boolean;
  item: MyGearItem;
}

export type {
  GearLibraryEntityDetail,
  GearLibraryEntitySummary,
  GearLibraryItemsResponse,
  GearLibraryListItem,
  GearLibraryListItemView,
  MyGearItem,
  MyGearRecord,
  MyGearRecordView,
  ItemDetailResponse,
  ItemDisplayProperty,
  ItemProperty
}
