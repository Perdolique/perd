import { startPagePath } from '#shared/constants'

function sanitizeRedirectPath(redirectTo: unknown) {
  if (typeof redirectTo !== 'string') {
    return startPagePath
  }

  const trimmedRedirectPath = redirectTo.trim()

  if (trimmedRedirectPath === '' || trimmedRedirectPath.startsWith('//')) {
    return startPagePath
  }

  if (trimmedRedirectPath.startsWith('/') === false) {
    return startPagePath
  }

  return trimmedRedirectPath
}

function isApiRedirectPath(path: string) {
  return path.startsWith('/api/')
}

export { isApiRedirectPath, sanitizeRedirectPath }
