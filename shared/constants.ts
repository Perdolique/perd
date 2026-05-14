const startPagePath = '/'

const limits = {
  maxBrandNameLength: 128,
  maxBrandSlugLength: 128,
  maxCategoryPropertyNameLength: 64,
  maxCategoryPropertySlugLength: 128,
  maxCategoryPropertyUnitLength: 16,
  maxEquipmentCategoryNameLength: 64,
  maxEquipmentCategorySlugLength: 128,
  maxEquipmentGroupNameLength: 64,
  maxEquipmentGroupSlugLength: 128,
  maxPackingListNameLength: 128,
  maxPaginatedListLimit: 100,
  maxOAuthProviderNameLength: 32,
  maxOAuthProviderTypeLength: 32,
  maxPropertyEnumOptionNameLength: 64,
  maxPropertyEnumOptionSlugLength: 128,
  maxUserNameLength: 32
} as const

export { startPagePath, limits }
