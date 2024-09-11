<template>
  <div :class="$style.component">
    <div :class="$style.header">
      <div :class="$style.logo">
        🐕💨
      </div>

      <div :class="$style.title">
        Welcome to Perd*!
      </div>

      <div :class="$style.note">
        *technical name
      </div>
    </div>

    <div :class="$style.buttons">
      <IconButton
        icon-name="tabler:brand-among-us"
        :class="$style.button"
        class="amogus"
        :loading="isAuthenticating"
        @click="signUp"
      />

      <IconButton
        :class="$style.button"
        class="twitch"
        icon-name="tabler:brand-twitch"
        :loading="isAuthenticating"
        @click="redirectToTwitch"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { startPagePath } from '~~/constants';
  import { startViewTransition } from '~/utils/dom';
  import IconButton from '~/components/IconButton.vue';

  definePageMeta({
    layout: false
  })

  const { user } = useUserStore()
  const route = useRoute()
  const isAuthenticating = ref(false)

  function startAuthenticating() {
    startViewTransition(() => {
      isAuthenticating.value = true
    })
  }

  async function signUp() {
    if (isAuthenticating.value) {
      return
    }

    startAuthenticating()

    try {
      const responsePromise = $fetch('/api/auth/create-session', {
        method: 'POST'
      })

      const response = await withMinimumDelay(responsePromise, 500)

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
    } catch (error) {
      // TODO: Handle error properly
      console.error(error)
    } finally {
      isAuthenticating.value = false
    }
  }

  function redirectToTwitch() {
    startAuthenticating()

    window.location.href = '/api/oauth/twitch'
  }
</script>

<style module>
  .component {
    display: grid;
    justify-content: center;
    text-align: center;
    row-gap: var(--spacing-16);
    padding: var(--spacing-32);
  }

  .logo {
    font-size: 4rem;
    white-space: nowrap;
  }

  .header {
    display: grid;
    gap: var(--spacing-32);
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .note {
    font-size: 0.75rem;
    margin-top: calc(-1 * var(--spacing-24));
  }

  .buttons {
    display: flex;
    gap: var(--spacing-8);
    justify-content: center;
  }

  .button {
    color: #fff;
    transition: background-color 0.2s;

    &:global(.twitch):not(:disabled) {
      background-color: #9146FF;

      &:focus-visible,
      &:hover {
        background-color: #772ce8;
      }

      &:active {
        background-color: #5b21b6;
      }
    }

    &:global(.amogus):not(:disabled) {
      background-color: #4CAF50;

      &:focus-visible,
      &:hover {
        background-color: #45a049;
      }

      &:active {
        background-color: #388e3c;
      }
    }
  }
</style>
