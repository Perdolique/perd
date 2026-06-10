<template>
  <main :class="$style.component">
    <picture :class="$style.backgroundMedia" aria-hidden="true">
      <source
        srcset="/images/login-background-desktop.avif"
        media="(width >= 860px)"
        type="image/avif"
      >

      <source
        srcset="/images/login-background-mobile.avif"
        type="image/avif"
      >

      <img
        :class="$style.backgroundImage"
        src="/images/login-background-mobile.avif"
        width="941"
        height="1672"
        alt=""
        decoding="async"
        fetchpriority="high"
        loading="eager"
      >
    </picture>

    <div :class="$style.content">
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
    </div>
  </main>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'
  import { $fetch } from 'ofetch'
  import { definePageMeta, navigateTo, useHead, useRoute, useUserStore, withMinimumDelay } from '#imports'
  import { getRedirectNavigationTarget } from '~/utils/router'
  import PerdButton from '~/components/PerdButton.vue'

  definePageMeta({
    layout: false
  })

  useHead({
    link: [{
      rel: 'preload',
      as: 'image',
      href: '/images/login-background-mobile.avif',
      type: 'image/avif',
      media: '(width < 860px)',
      fetchpriority: 'high'
    }, {
      rel: 'preload',
      as: 'image',
      href: '/images/login-background-desktop.avif',
      type: 'image/avif',
      media: '(width >= 860px)',
      fetchpriority: 'high'
    }]
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
    position: relative;
    isolation: isolate;
    min-block-size: 100dvh;
    display: grid;
    place-items: center;
    overflow: hidden;
    padding:
      max(var(--spacing-24), env(safe-area-inset-top))
      var(--spacing-16)
      max(var(--spacing-24), env(safe-area-inset-bottom));
    background: var(--color-background-muted);
    color: oklch(99% 0 0);

    &::after {
      content: "";
      position: absolute;
      z-index: 1;
      inset: 0;
      background:
        linear-gradient(
          180deg,
          color-mix(in oklch, var(--color-overlay-background), transparent 78%),
          color-mix(in oklch, var(--color-overlay-background), transparent 6%)
        );
      pointer-events: none;
    }

    @media (width >= 860px) {
      padding-inline: var(--spacing-32);
    }
  }

  .backgroundMedia {
    position: absolute;
    z-index: 0;
    inset: 0;
  }

  .backgroundImage {
    inline-size: 100%;
    block-size: 100%;
    display: block;
    object-fit: cover;
    object-position: center bottom;
  }

  .content {
    position: relative;
    z-index: 2;
    inline-size: min(100%, 24rem);
    margin-inline: auto;
    display: grid;
    gap: var(--spacing-16);
  }

  .buttons {
    display: grid;
    gap: var(--spacing-12);
  }

  .button {
    inline-size: 100%;
  }
</style>
