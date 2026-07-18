import { stringifyQuery, type LocationQuery } from 'vue-router'
import {
  buildGearLibraryRouteQuery,
  getGearLibraryRouteState
} from '~/utils/gear-library'
import { appRoutes } from '~/utils/navigation'

type ParsedSearchParams = InstanceType<typeof globalThis.URLSearchParams>

function getLocationQueryFromSearchParams(searchParams: ParsedSearchParams): LocationQuery {
  const query: LocationQuery = {}

  for (const [key, value] of searchParams) {
    const existingValue = query[key]

    if (existingValue === undefined) {
      query[key] = value
    } else if (Array.isArray(existingValue)) {
      query[key] = [...existingValue, value]
    } else {
      query[key] = [existingValue, value]
    }
  }

  return query
}

function getCanonicalGearLibraryReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const hasInternalPathPrefix = value.startsWith('/') && value.startsWith('//') === false

  if (hasInternalPathPrefix === false) {
    return null
  }

  try {
    const internalOrigin = 'https://perd.internal'
    const parsedUrl = new globalThis.URL(value, internalOrigin)
    const hasExactCatalogPath = parsedUrl.origin === internalOrigin
      && parsedUrl.pathname === appRoutes.gearLibrary
      && parsedUrl.hash === ''

    if (hasExactCatalogPath === false) {
      return null
    }

    const routeQuery = getLocationQueryFromSearchParams(parsedUrl.searchParams)
    const routeState = getGearLibraryRouteState(routeQuery)
    const canonicalQuery = buildGearLibraryRouteQuery(routeState)
    const queryString = stringifyQuery(canonicalQuery)

    return queryString === ''
      ? appRoutes.gearLibrary
      : `${appRoutes.gearLibrary}?${queryString}`
  } catch {
    return null
  }
}

function sanitizeGearLibraryReturnPath(value: unknown) {
  return getCanonicalGearLibraryReturnPath(value) ?? appRoutes.gearLibrary
}

export {
  getCanonicalGearLibraryReturnPath,
  sanitizeGearLibraryReturnPath
}
