import { startPagePath } from '#shared/constants'

function sanitizeRedirectPath(redirectTo: unknown): string {
  if (typeof redirectTo !== 'string') {
    return startPagePath
  }

  const trimmedRedirectPath = redirectTo.trim()
  // Reject URL parser normalization of backslashes and ASCII controls.
  // oxlint-disable-next-line no-control-regex -- These characters can turn a relative redirect into an external URL.
  const hasUnsafeCharacters = /[\\\u0000-\u001F\u007F]/u.test(redirectTo)

  if (hasUnsafeCharacters || trimmedRedirectPath === '' || trimmedRedirectPath.startsWith('//')) {
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
