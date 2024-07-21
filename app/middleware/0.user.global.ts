export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    const { getUser, user } = useUserStore()

    if (user.value.hasData === false) {
      await getUser()
    }
  }
})
