import type { LocationQuery, LocationQueryRaw, LocationQueryValue } from 'vue-router'

interface GearLibraryRouteState {
  page: number;
}

interface GearLibraryItemsApiQuery {
  page: number;
}

function getSingleQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizePageQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  const singleValue = getSingleQueryValue(value)

  if (singleValue === undefined || singleValue === null) {
    return 1
  }

  const parsedValue = Number(singleValue)
  const isPositiveInteger = Number.isInteger(parsedValue) && parsedValue > 0

  if (isPositiveInteger === false) {
    return 1
  }

  return parsedValue
}

function getGearLibraryRouteState(query: LocationQuery): GearLibraryRouteState {
  return {
    page: normalizePageQueryValue(query.page)
  }
}

function getGearLibraryItemsApiQuery(query: LocationQuery): GearLibraryItemsApiQuery {
  return {
    page: getGearLibraryRouteState(query).page
  }
}

function buildGearLibraryRouteQuery(routeState: GearLibraryRouteState): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (routeState.page > 1) {
    query.page = String(routeState.page)
  }

  return query
}

export {
  buildGearLibraryRouteQuery,
  getGearLibraryItemsApiQuery,
  getGearLibraryRouteState
}
