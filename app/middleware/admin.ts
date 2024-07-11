import { sessionCookieName } from "~~/constants";

export default defineNuxtRouteMiddleware(async (to, from) => {
  const nuxtApp = useNuxtApp()
  const ssrEvent = useRequestEvent()
  let isAdmin = false;

  // https://nuxt.com/docs/guide/directory-structure/middleware#when-middleware-runs
  if (import.meta.client && nuxtApp.isHydrating && nuxtApp.payload.serverRendered) {
    return
  }

  // We need to pass cookies to the server.
  // It's possible only with useFetch during SSR, but useFetch on the client produces warning
  if (import.meta.client) {
    const response = await $fetch('/api/auth/check-admin')

    isAdmin = response.isAdmin
  } else {
    const result = await useFetch('/api/auth/check-admin', {
      // FIXME: This glans is overcomplicated and shouldn't exist
      onResponse(event) {
        if (ssrEvent !== undefined) {
          const foundCookie = event.response.headers
            .get('set-cookie')
            ?.split(',')
            .find(cookie => cookie.startsWith(`${sessionCookieName}=`))

          if (foundCookie !== undefined) {
            ssrEvent.node.res.setHeader('set-cookie', foundCookie)
          }
        }
      }
    })

    isAdmin = result.data.value?.isAdmin === true;
  }

  if (isAdmin === false && to.path !== '/') {
    return navigateTo('/', {
      replace: true
    })
  }
})
