export default defineNuxtRouteMiddleware(async (to, from) => {
  let isAdmin = false;

  // We need to pass cookies to the server.
  // It's possible only with useFetch during SSR, but useFetch on the client produces warning
  if (import.meta.client) {
    const response = await $fetch('/api/auth/check-admin')

    isAdmin = response.isAdmin
  } else {
    const result = await useFetch('/api/auth/check-admin')

    isAdmin = result.data.value?.isAdmin === true;
  }

  if (isAdmin === false && to.path !== '/') {
    return navigateTo('/', {
      replace: true
    })
  }
})
