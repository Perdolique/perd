const startPagePath = '/'

const limits = {
  maxBrandNameLength: 128,
  maxBrandSlugLength: 128,
  maxEquipmentGroupNameLength: 64,
  maxEquipmentGroupSlugLength: 128,
  maxOAuthProviderNameLength: 32,
  maxOAuthProviderTypeLength: 32,
  maxUserNameLength: 32
} as const

export { startPagePath, limits }
