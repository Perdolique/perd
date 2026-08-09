import { computed } from 'vue'
import { useFetch, useState } from '#imports'

interface User {
  userId: string | null;
  isAdmin: boolean;
  isGuest: boolean;
  hasData: boolean;
}

export function useUserStore() {
  const user = useState<User>('user', () => {
    return {
      userId: null,
      isAdmin: false,
      isGuest: false,
      hasData: false
    }
  })

  const isAuthenticated = computed(() => user.value.userId !== null)

  async function getUser() {
    const { data } = await useFetch('/api/user')

    if (data.value?.userId !== undefined) {
      user.value.userId = data.value.userId
      user.value.isAdmin = data.value.isAdmin
      user.value.isGuest = data.value.isGuest
    }

    user.value.hasData = true
  }

  function resetAuthentication() {
    user.value.userId = null
    user.value.isAdmin = false
    user.value.isGuest = false
  }

  return {
    getUser,
    isAuthenticated,
    resetAuthentication,
    user
  }
}
