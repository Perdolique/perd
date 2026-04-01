const startPagePath = '/'

const limits = {
  maxOAuthProviderNameLength: 32,
  maxOAuthProviderTypeLength: 32,
  maxUserNameLength: 32
} as const

export { startPagePath, limits }
