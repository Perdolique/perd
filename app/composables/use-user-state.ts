interface User {
  userId: string | null;
  isAdmin: boolean;
  hasData: boolean;
}

export function useUserStore() {
  const user = useState<User>('user',  () => ({
    userId: null,
    isAdmin: false,
    hasData: false
  }))

  const isAuthenticated = computed(() => user.value.userId !== null)

  async function getUser() {
    const { data } = await useFetch('/api/user')

    if (data.value?.userId !== undefined) {
      user.value.userId = data.value.userId
      user.value.isAdmin = data.value.isAdmin
    }

    user.value.hasData = true
  }

  function resetAuthentication() {
    user.value.userId = null
    user.value.isAdmin = false
  }

  return {
    getUser,
    isAuthenticated,
    resetAuthentication,
    user
  }
}
