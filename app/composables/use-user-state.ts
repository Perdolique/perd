interface UserState {
  userId: string | null
  isAdmin: boolean
}

export function useUserState() {
  const userState = useState<UserState>('userState',  () => ({
    userId: null,
    isAdmin: false
  }))

  const isAuthorized = computed(() => userState.value.userId !== null)

  function resetUserState() {
    userState.value.userId = null
    userState.value.isAdmin = false
  }

  return {
    isAuthorized,
    resetUserState,
    userState
  }
}
