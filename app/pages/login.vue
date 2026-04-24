<template>
  <div :class="$style.component">
    <div :class="$style.layout">
      <section :class="$style.hero">
        <p :class="$style.brand">
          perd<span :class="$style.brandPunctuation">.</span>
        </p>

        <PerdHeading :level="1" :class="$style.title">
          Your Adventure Hub
        </PerdHeading>

        <p :class="$style.copy">
          Keep your field kit close, pick up approved catalog entries, and move between routes without losing your place.
        </p>
      </section>

      <section :class="$style.card">
        <p :class="$style.cardLabel">
          Access
        </p>

        <PerdHeading :level="2">
          Sign in to continue
        </PerdHeading>

        <p :class="$style.cardCopy">
          Use a quick guest session or continue with Twitch. Redirect flow stays the same.
        </p>

        <div :class="$style.buttons">
          <PerdButton
            icon="tabler:brand-among-us"
            :class="$style.button"
            :loading="isAuthenticating"
            @click="signUp"
          >
            Guest
          </PerdButton>

          <PerdButton
            variant="secondary"
            :class="$style.button"
            icon="tabler:brand-twitch"
            :loading="isAuthenticating"
            @click="redirectToTwitch"
          >
            Twitch
          </PerdButton>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'
  import { $fetch } from 'ofetch'
  import { definePageMeta, navigateTo, useRoute, useUserStore, withMinimumDelay } from '#imports'
  import { getRedirectNavigationTarget } from '~/utils/router'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  definePageMeta({
    layout: false
  })

  const { user } = useUserStore()
  const route = useRoute()
  const isAuthenticating = ref(false)

  function startAuthenticating() {
    isAuthenticating.value = true
  }

  async function navigateAfterLogin(redirectTo: unknown) {
    const navigationTarget = getRedirectNavigationTarget(redirectTo)

    await navigateTo(navigationTarget.path, {
      replace: true,
      external: navigationTarget.external
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
        user.value.hasData = true
      }

      await navigateAfterLogin(route.query.redirectTo)
    } catch (error) {
      console.error(error)
    } finally {
      isAuthenticating.value = false
    }
  }

  function redirectToTwitch() {
    startAuthenticating()

    const navigationTarget = getRedirectNavigationTarget(route.query.redirectTo)

    void navigateTo({
      path: '/api/oauth/twitch',

      query: {
        redirectTo: navigationTarget.path
      }
    }, {
      external: true
    })
  }
</script>

<style module>
  .component {
    min-height: 100dvh;
    display: grid;
    padding: var(--spacing-16);
    background:
      radial-gradient(circle at top left, color-mix(in oklch, var(--color-accent-base), transparent 88%), transparent 30%),
      linear-gradient(180deg, var(--color-background-base), var(--color-background-sunken));
  }

  .layout {
    width: min(100%, 66rem);
    margin: auto;
    display: grid;
    gap: var(--spacing-24);

    @media (width >= 860px) {
      grid-template-columns: minmax(0, 1.1fr) minmax(24rem, 0.9fr);
      align-items: stretch;
    }
  }

  .hero,
  .card {
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-border-subtle);
    overflow: hidden;
  }

  .hero {
    display: grid;
    align-content: end;
    gap: var(--spacing-16);
    min-height: 24rem;
    padding: var(--spacing-32) var(--spacing-24);
    background:
      linear-gradient(180deg, color-mix(in oklch, var(--color-overlay-background), transparent 46%), transparent 35%),
      url('/dog_items_1024.webp') right / cover;
    color: oklch(99% 0 0);
    box-shadow: var(--shadow-2);
  }

  .brand,
  .cardLabel {
    margin: 0;
    font-size: var(--font-size-12);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .brand {
    color: color-mix(in oklch, white, transparent 14%);
    font-weight: var(--font-weight-bold);
  }

  .brandPunctuation {
    color: color-mix(in oklch, var(--color-accent-base), white 20%);
  }

  .title {
    max-width: 10ch;
    color: inherit;
  }

  .copy {
    margin: 0;
    max-width: 26rem;
    color: color-mix(in oklch, white, transparent 18%);
  }

  .card {
    display: grid;
    padding: var(--spacing-24) var(--spacing-16);
    gap: var(--spacing-16);
    background: var(--color-surface-base);
  }

  .cardLabel {
    color: var(--color-text-muted);
  }

  .cardCopy {
    margin: 0;
    color: var(--color-text-tertiary);
  }

  .buttons {
    display: grid;
    gap: var(--spacing-12);

    @media (width >= 520px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .button {
    width: 100%;
  }
</style>
