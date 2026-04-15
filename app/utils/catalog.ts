import type { LocationQuery, LocationQueryRaw, LocationQueryValue } from 'vue-router'

interface CatalogRouteState {
  page: number;
}

interface CatalogItemsApiQuery {
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

function getCatalogRouteState(query: LocationQuery): CatalogRouteState {
  return {
    page: normalizePageQueryValue(query.page)
  }
}

function getCatalogItemsApiQuery(query: LocationQuery): CatalogItemsApiQuery {
  return {
    page: getCatalogRouteState(query).page
  }
}

function buildCatalogRouteQuery(routeState: CatalogRouteState): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (routeState.page > 1) {
    query.page = String(routeState.page)
  }

  return query
}

export {
  buildCatalogRouteQuery,
  getCatalogItemsApiQuery,
  getCatalogRouteState
}
