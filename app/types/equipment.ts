interface GearLibraryEntitySummary {
  name: string;
  slug: string;
}

interface GearLibraryEntityDetail extends GearLibraryEntitySummary {
  id: number;
}

interface GearLibraryFilterProperty extends GearLibraryEntitySummary {
  dataType: EquipmentPropertyDataType;
  enumOptions?: GearLibraryEntitySummary[];
  unit: string | null;
}

interface GearLibraryListItem {
  brand: GearLibraryEntitySummary;
  category: GearLibraryEntitySummary;
  id: string;
  name: string;
  properties: GearLibraryListProperty[];
}

interface GearLibraryListItemView {
  brand: GearLibraryEntitySummary;
  category: GearLibraryEntitySummary;
  detailPath: string;
  id: string;
  name: string;
  properties: GearLibraryListProperty[];
}

interface GearLibraryItemsResponse {
  items: GearLibraryListItem[];
  limit: number;
  page: number;
  total: number;
}

type GearLibraryComparisonSelectionStatus = 'error' | 'loading' | 'resolved'

interface GearLibraryComparisonSelectionItem {
  brandName?: string;
  id: string;
  name?: string;
  status: GearLibraryComparisonSelectionStatus;
}

type EquipmentPropertyDataType = 'boolean' | 'enum' | 'number' | 'text'
type EquipmentPropertyValue = string | number | boolean | null

interface ItemProperty {
  dataType: EquipmentPropertyDataType;
  name: string;
  slug: string;
  unit: string | null;
  value: EquipmentPropertyValue;
}

interface GearLibraryListProperty extends ItemProperty {
  enumOptionName?: string;
}

interface ItemDetailResponse {
  brand: GearLibraryEntityDetail;
  category: GearLibraryEntityDetail;
  createdAt: string;
  id: string;
  name: string;
  properties: ItemProperty[];
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
  EquipmentPropertyDataType,
  EquipmentPropertyValue,
  GearLibraryEntityDetail,
  GearLibraryEntitySummary,
  GearLibraryComparisonSelectionItem,
  GearLibraryComparisonSelectionStatus,
  GearLibraryFilterProperty,
  GearLibraryItemsResponse,
  GearLibraryListItem,
  GearLibraryListProperty,
  GearLibraryListItemView,
  MyGearItem,
  MyGearRecord,
  MyGearRecordView,
  ItemDetailResponse,
  ItemDisplayProperty,
  ItemProperty
}
