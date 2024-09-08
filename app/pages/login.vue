<template>
  <div :class="$style.component">
    <PerdButton @click="signUp">
      Sign up anonymously
    </PerdButton>

    <PerdLink
      to="/api/oauth/twitch"
      external
    >
      Sign in with Twitch
    </PerdLink>
  </div>
</template>

<script lang="ts" setup>
  import { startPagePath } from '~~/constants';
  import PerdButton from '~/components/PerdButton.vue';
  import PerdLink from '~/components/PerdLink.vue';

  definePageMeta({
    layout: false
  })

  const { user } = useUserStore()
  const route = useRoute()

  async function signUp() {
    const response = await $fetch('/api/auth/create-session', {
      method: 'POST'
    })

    if (typeof response.userId === 'string') {
      user.value.userId = response.userId
    }

    const redirectPath =
      typeof route.query.redirectTo === 'string'
        ? route.query.redirectTo
        : startPagePath

    await navigateTo(redirectPath, {
      replace: true
    })
  }
</script>

<style module>
  .component {
    display: grid;
    justify-content: center;
    text-align: center;
    gap: var(--spacing-16);
    padding-top: var(--spacing-32);
  }
</style>
