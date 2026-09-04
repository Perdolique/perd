<template>
  <div :class="$style.component">
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

    <main :class="$style.content">
      <TurnstileWidget
        ref="turnstileWidget"
        v-model="turnstileToken"
        :sitekey="turnstileSiteKey"
      />

      <p v-if="hasGuestError" :class="$style.error" role="alert">
        {{ guestError }}
      </p>

      <div :class="$style.buttons">
        <PerdButton
          variant="secondary"
          icon="hugeicons:game"
          :class="$style.button"
          :disabled="isGuestDisabled"
          :loading="isAuthenticating"
          @click="continueAsGuest"
        >
          Guest
        </PerdButton>

        <PerdButton
          :class="$style.button"
          icon="hugeicons:twitch"
          :loading="isAuthenticating"
          @click="redirectToTwitch"
        >
          Twitch
        </PerdButton>
      </div>
    </main>

    <footer :class="$style.footer">
      <a
        :class="$style.footerLink"
        href="https://github.com/Perdolique/perd"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>

      <span v-if="buildCommitSha" :class="$style.commit">
        Commit
        <a
          :class="$style.footerLink"
          :href="buildCommitUrl"
          target="_blank"
          rel="noreferrer"
        >
          #{{ buildCommitShortSha }}
        </a>
      </span>
    </footer>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, useTemplateRef } from 'vue'

  import {
    definePageMeta,
    navigateTo,
    useHead,
    useRequestFetch,
    useRoute,
    useRuntimeConfig,
    useUserStore,
    withMinimumDelay
  } from '#imports'

  import { turnstileResponseFieldName } from '#shared/utils/turnstile'
  import { getRedirectNavigationTarget } from '~/utils/router'
  import PerdButton from '~/components/PerdButton.vue'
  import TurnstileWidget from '~/components/auth/TurnstileWidget.vue'

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
  const requestFetch = useRequestFetch()
  const route = useRoute()
  const turnstileWidget = useTemplateRef('turnstileWidget')
  const turnstileToken = ref('')
  const guestError = ref<string | null>(null)
  const isAuthenticating = ref(false)
  const hasGuestError = computed(() => guestError.value !== null)

  const isGuestDisabled = computed(
    () => isAuthenticating.value || turnstileToken.value === ''
  )

  const {
    public: {
      buildCommitSha,
      turnstileSiteKey
    }
  } = useRuntimeConfig()

  const buildCommitShortSha = buildCommitSha.slice(0, 7)
  const buildCommitUrl = `https://github.com/Perdolique/perd/commit/${buildCommitSha}`

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

  function getRequestStatus(error: unknown): number | undefined {
    if (error === null || typeof error !== 'object') {
      return
    }

    const statusCode = Reflect.get(error, 'statusCode')

    if (typeof statusCode === 'number') {
      return statusCode
    }

    const status = Reflect.get(error, 'status')

    return typeof status === 'number' ? status : undefined
  }

  function getGuestErrorMessage(error: unknown): string {
    const status = getRequestStatus(error)

    if (status === 403) {
      return 'Security check failed. Try again.'
    } else if (status === 429) {
      return 'Too many Guest attempts. Try again in a minute.'
    } else if (status === 503) {
      return 'Guest access is temporarily unavailable. Try again.'
    }

    return 'Could not continue as Guest. Try again.'
  }

  async function requestGuestSession(requestToken: string) {
    try {
      const responsePromise = requestFetch('/api/auth/create-session', {
        body: {
          [turnstileResponseFieldName]: requestToken
        },

        method: 'POST'
      })

      return await withMinimumDelay(responsePromise, 500)
    } catch (error) {
      guestError.value = getGuestErrorMessage(error)

      return null
    } finally {
      turnstileWidget.value?.reset()
      isAuthenticating.value = false
    }
  }

  async function continueAsGuest() {
    if (isGuestDisabled.value) {
      return
    }

    startAuthenticating()
    guestError.value = null

    const response = await requestGuestSession(turnstileToken.value)

    if (response === null) {
      return
    }

    user.value.userId = response.userId
    user.value.isGuest = response.isGuest
    user.value.hasData = true

    await navigateAfterLogin(route.query.redirectTo)
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
    grid-template-rows: 1fr auto;
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
    grid-row: 1;
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

  .error {
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-6);
    background: var(--color-black);
    color: var(--color-white);
    font-size: var(--font-size-14);
    text-align: center;
  }

  .footer {
    position: relative;
    z-index: 2;
    grid-row: 2;
    inline-size: min(100%, 24rem);
    margin-inline: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-8) var(--spacing-16);
    padding-block: var(--spacing-8);
    color: color-mix(in oklch, var(--color-white) 82%, transparent);
    font-size: var(--font-size-14);
    text-align: center;
  }

  .commit {
    display: inline-flex;
    align-items: baseline;
    gap: var(--spacing-4);
  }

  .footerLink {
    color: var(--color-white);
    font-weight: var(--font-weight-semibold);
    text-decoration: none;
    text-underline-offset: var(--spacing-4);

    &:hover,
    &:focus-visible {
      text-decoration: underline;
    }

    &:active {
      color: var(--color-sand-100);
    }
  }
</style>
