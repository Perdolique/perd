import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import {
  buildGearLibraryRouteQuery,
  getGearLibraryRouteState,
  isGearLibraryRouteQueryCanonical
} from '~/utils/gear-library'

export default defineNuxtRouteMiddleware(async (to) => {
  const isCanonical = isGearLibraryRouteQueryCanonical(to.query)

  if (isCanonical) {
    return
  }

  const routeState = getGearLibraryRouteState(to.query)
  const query = buildGearLibraryRouteQuery(routeState)

  return navigateTo({
    hash: to.hash,
    path: to.path,
    query
  }, {
    replace: true
  })
})
