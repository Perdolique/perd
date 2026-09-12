<template>
  <div :class="$style.component">
    <div :class="$style.card">
      <div :class="$style.label">
        Twitch
      </div>

      <div :class="$style.progress">
        <div
          v-if="isFailed"
          :class="$style.icon"
        >
          💀
        </div>

        <FidgetSpinner v-else :class="$style.spinner" />
      </div>

      <div role="status" aria-live="polite">
        <PerdHeading :level="2">
          {{ statusHeading }}
        </PerdHeading>
      </div>

      <PerdLink
        v-if="isFailed"
        to="/login"
      >
        Return to sign in
      </PerdLink>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue'
  import { definePageMeta, navigateTo, useHead, useRequestFetch, useRoute, useRouter, useUserStore } from '#imports'
  import { getTwitchCallbackError } from '~/utils/twitch-oauth'
  import { getRedirectNavigationTarget } from '~/utils/router'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'

  definePageMeta({
    layout: false,
    skipAuth: true
  })

  useHead({ meta: [{
    name: 'referrer',
    content: 'no-referrer'
  }] })

  const errorMessage = ref<string | null>(null)
  const isFailed = computed(() => errorMessage.value !== null)
  const requestFetch = useRequestFetch()
  const router = useRouter()
  const route = useRoute()
  const { user } = useUserStore()
  const statusHeading = computed(() => errorMessage.value ?? 'Connecting Twitch')

  async function handleConnect() {
    const body = {
      code: route.query.code,
      error: route.query.error,
      state: route.query.state
    }

    try {
      await router.replace({
        path: '/auth/twitch',
        query: {},
        hash: ''
      })

      const result = await requestFetch('/api/oauth/twitch', {
        method: 'POST',
        body
      })

      user.value.email = result.email
      user.value.userId = result.userId
      user.value.isAdmin = result.isAdmin
      user.value.isGuest = result.isGuest
      user.value.hasData = true

      const navigationTarget = getRedirectNavigationTarget(result.redirectTo)

      await navigateTo(navigationTarget.path, {
        replace: true,
        external: navigationTarget.external
      })
    } catch (error) {
      errorMessage.value = getTwitchCallbackError(error)
    }
  }

  onMounted(() => {
    void handleConnect()
  })
</script>

<style module>
  .component {
    min-block-size: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--spacing-16);
    background:
      linear-gradient(180deg, var(--color-background-page), var(--color-background-muted));
  }

  .card {
    display: grid;
    row-gap: var(--spacing-16);
    justify-items: center;
    text-align: center;
    text-wrap: balance;
    inline-size: min(100%, 28rem);
    padding: var(--spacing-24);
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-border-subtle);
    background: linear-gradient(180deg, var(--color-surface-primary), var(--color-surface-secondary));
    box-shadow: var(--shadow-medium);
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .progress {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 4rem;
    block-size: 4rem;
    border-radius: var(--border-radius-pill);
    background: var(--color-surface-secondary);
    border: 1px solid var(--color-border-subtle);
  }

  .icon {
    font-size: 32px;
  }

  .spinner {
    font-size: 1.75rem;
    color: var(--color-accent-primary);
  }
</style>
