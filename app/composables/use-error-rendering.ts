import { useError, useNuxtApp } from '#imports'

/** Skips guards only for the error render, never for a later destination. */
function useIsErrorRendering(path: string): boolean {
  const error = useError()

  if (!error.value) {
    return false
  }

  const nuxtApp = useNuxtApp()
  const errorPath = nuxtApp.payload.path?.split('?')[0]

  return import.meta.server === true || (nuxtApp.isHydrating === true && path === errorPath)
}

export { useIsErrorRendering }
