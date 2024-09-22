export const sessionCookieName = 'perdSession'
export const adminCheckInterval = 60 * 60 * 1000
export const startPagePath = '/'

export const publicApiPaths = [
  '/auth/create-session',
  '/oauth/twitch'
]

export const limits = {
  maxChecklistNameLength: 32,
  maxEquipmentItemNameLength: 64,
  maxEquipmentTypeNameLength: 32,
  maxEquipmentGroupNameLength: 32,
  maxEquipmentAttributeNameLength: 32,
  maxOAuthProviderTypeLength: 32,
  maxOAuthProviderNameLength: 32,
  maxUserNameLength: 32
}
