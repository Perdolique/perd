import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import {
  buildGearLibraryRouteQuery,
  getGearLibraryRouteState,
  isGearLibraryRouteQueryCanonical
} from '~/utils/gear-library'

export default defineNuxtRouteMiddleware(async (to) => {
  const {
    compare: comparisonQuery,
    ...browsingQuery
  } = to.query
  const isCanonical = isGearLibraryRouteQueryCanonical(browsingQuery)

  if (isCanonical) {
    return
  }

  const routeState = getGearLibraryRouteState(to.query)
  const query = buildGearLibraryRouteQuery(routeState)

  if (comparisonQuery !== undefined) {
    query.compare = comparisonQuery
  }

  return navigateTo({
    hash: to.hash,
    path: to.path,
    query
  }, {
    replace: true
  })
})
