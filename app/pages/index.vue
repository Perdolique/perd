<template>
  <div :class="$style.component">
    <NuxtLink to="/admin/gears">Gears admin</NuxtLink>

    <button
      v-if="isAuthorized"
      @click="removeAuthSession"
    >
      Log out
    </button>

    <div
      v-else
      :class="$style.buttons"
    >
      <button @click="handleSignInClick">
        Sign in anonymously
      </button>

      <button @click="handleSignInAdminClick">
        Sign in as admin
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  const isAuthorized = useState('isAuthorized')

  async function handleSignInClick() {
    const response = await $fetch('/api/auth/create-session', {
      method: 'post'
    })

    if (typeof response.userId === 'string') {
      isAuthorized.value = true
    }
  }

  async function handleSignInAdminClick() {
    const response = await $fetch('/api/auth/create-session', {
      method: 'post',

      body: {
        isAdmin: true
      }
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
    grid-auto-rows: min-content;
    row-gap: 16px;
    padding: 50px 0;
  }

  .buttons {
    display: flex;
    column-gap: 16px;
  }
</style>
