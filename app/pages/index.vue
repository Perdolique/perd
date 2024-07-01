<template>
  <div :class="$style.component">
    <button
      v-if="isAuthorized"
      @click="removeAuthSession"
    >
      Log out
    </button>

    <button
      v-else
      @click="handleClick"
    >
      Sign in anonymously
    </button>
  </div>
</template>

<script lang="ts" setup>
  const isAuthorized = useState('isAuthorized')

  async function handleClick() {
    const response = await $fetch('/api/auth/create-session', {
      method: 'post'
    })

    if (typeof response.userId === 'string') {
      isAuthorized.value = true
    }
  }

  async function removeAuthSession() {
    await $fetch('/api/auth/logout', {
      method: 'post'
    })

    isAuthorized.value = false
  }
</script>

<style module>
  .component {
    height: 100vh;
    width: 100vw;
    display: grid;
    place-items: center;
  }
</style>
