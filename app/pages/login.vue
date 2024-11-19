<template>
  <div :class="$style.component">
    <div :class="$style.card">
      <PerdHeading :level="1" :class="$style.title">
        Your Adventure Hub
      </PerdHeading>

      <div :class="$style.buttons">
        <PerdButton
          icon="tabler:brand-among-us"
          :class="$style.button"
          class="amogus"
          :loading="isAuthenticating"
          @click="signUp"
        >
          Guest
        </PerdButton>

        <PerdButton
          :class="$style.button"
          class="twitch"
          icon="tabler:brand-twitch"
          :loading="isAuthenticating"
          @click="redirectToTwitch"
        >
          Twitch
        </PerdButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { startPagePath } from '~~/constants';
  import { startViewTransition } from '~/utils/dom';
  import PerdButton from '~/components/PerdButton.vue';
  import PerdHeading from '~/components/PerdHeading.vue';

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

<style lang="scss" module>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .component {
    height: 100%;
    background: var(--background-100);

    @include tablet {
      display: grid;
      place-items: center;
      padding: var(--spacing-24);
    }
  }

  .card {
    height: 100%;
    display: grid;
    padding: var(--spacing-16);
    row-gap: var(--spacing-16);
    align-content: space-between;
    background:
      linear-gradient(
        to bottom,
        color-mix(in oklch, var(--overlay-color-background), black 40%) 0%,
        transparent 40%,
        color-mix(in oklch, var(--overlay-color-background), transparent 50%) 70%,
        color-mix(in oklch, var(--overlay-color-background), black 60%) 100%
      ),
      url('public/dog_items_1024.webp') right / cover;

    @include tablet {
      width: 480px;
      max-height: 480px;
      border-radius: var(--border-radius-24);
      background-position: center;
    }
  }

  .title {
    padding: var(--spacing-24) 0;
    text-align: center;
    color: oklch(100% 0 0);
    animation: fadeIn 0.8s ease-out;
  }

  .buttons {
    display: grid;
    gap: var(--spacing-12);
    padding: var(--spacing-24) var(--spacing-16);
    border-radius: var(--border-radius-24);

    @include mobileLarge {
      grid-auto-flow: column;
      width: 400px;
      justify-self: center;
    }
  }

  .button {
    color: oklch(100% 0 0);
    width: 100%;
    transition: background-color var(--transition-time-quick);

    &:global(.twitch):not(:disabled) {
      background-color: rgba(145, 70, 255, 0.9);

      &:hover {
        background-color: rgba(145, 70, 255, 1);
      }
    }

    &:global(.amogus):not(:disabled) {
      background-color: rgba(76, 175, 80, 0.9);

      &:hover {
        background-color: rgba(76, 175, 80, 1);
      }
    }
  }
</style>
