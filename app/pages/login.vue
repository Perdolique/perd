<template>
  <div :class="$style.component">
    <PerdButton @click="handleSignInClick">
      Sign in anonymously
    </PerdButton>

    <PerdButton @click="handleSignInAdminClick">
      Sign in as admin
    </PerdButton>
  </div>
</template>

<script lang="ts" setup>
  import PerdButton from '~/components/PerdButton.vue';

  definePageMeta({
    layout: 'page'
  })

  const { user } = useUserStore()
  const route = useRoute()

  async function signIn(isAdmin: boolean) {
    const response = await $fetch('/api/auth/create-session', {
      method: 'POST',

      body: {
        isAdmin
      }
    })

    if (typeof response.userId === 'string') {
      user.value.userId = response.userId
    }

    if (response.isAdmin === true) {
      user.value.isAdmin = true
    }

    const redirectPath =
      typeof route.query.redirectTo === 'string'
        ? route.query.redirectTo
        : '/'

    await navigateTo(redirectPath, {
      replace: true
    })
  }

  async function handleSignInClick() {
    await signIn(false)
  }

  async function handleSignInAdminClick() {
    await signIn(true)
  }
</script>

<style module>
  .component {
    display: flex;
    justify-content: center;
    gap: var(--spacing-16);
    padding-top: var(--spacing-32);
  }
</style>
