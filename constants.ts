export const sessionCookieName = 'perdSession'
export const adminCheckInterval = 60 * 60 * 1000
export const startPagePath = '/'

export const publicApiPaths = [
  '/auth/create-session',
  '/oauth/twitch'
] as const

export const limits = {
  maxChecklistNameLength: 32,
  maxEquipmentAttributeNameLength: 32,
  maxEquipmentDescriptionLength: 1024,
  maxEquipmentGroupNameLength: 32,
  maxEquipmentItemNameLength: 64,
  maxEquipmentItemStatusLength: 16,
  maxEquipmentTypeNameLength: 32,
  maxOAuthProviderNameLength: 32,
  maxOAuthProviderTypeLength: 32,
  maxUserNameLength: 32
} as const
