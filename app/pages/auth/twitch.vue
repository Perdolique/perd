<template>
  <div :class="$style.component">
    <div :class="$style.card">
      <p :class="$style.label">
        Twitch
      </p>

      <div :class="$style.progress">
        <div
          v-if="isFailed"
          :class="$style.icon"
        >
          💀
        </div>

        <FidgetSpinner v-else :class="$style.spinner" />
      </div>

      <PerdHeading :level="2">
        {{ statusHeading }}
      </PerdHeading>

      <p :class="$style.copy" v-if="isFailed">
        Failed to connect <strong>Twitch</strong>
      </p>

      <p :class="$style.copy" v-else>
        Connecting <strong>Twitch</strong>...
      </p>

      <PerdLink
        v-if="isFailed"
        to="/"
      >
        Return to Home
      </PerdLink>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onBeforeMount, ref } from 'vue'
  import { $fetch } from 'ofetch'
  import { definePageMeta, navigateTo, useRoute, useUserStore } from '#imports'
  import { getRedirectNavigationTarget } from '~/utils/router'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'

  definePageMeta({
    layout: false,
    skipAuth: true
  })

  const isFailed = ref(false)
  const route = useRoute()
  const { user } = useUserStore()
  const statusHeading = computed(() => isFailed.value ? 'Failed to connect Twitch' : 'Connecting Twitch...')

  async function handleConnect() {
    try {
      const result = await $fetch('/api/oauth/twitch', {
        method: 'POST',

        body: JSON.stringify({
          code: route.query.code
        })
      })

      if (result === undefined) {
        throw new Error('Failed to connect Twitch')
      }

      user.value.userId = result.userId
      user.value.isAdmin = result.isAdmin
      user.value.hasData = true

      const navigationTarget = getRedirectNavigationTarget(route.query.state)

      await navigateTo(navigationTarget.path, {
        replace: true,
        external: navigationTarget.external
      })
    } catch {
      isFailed.value = true
    }
  }

  onBeforeMount(() => {
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
      radial-gradient(circle at top left, color-mix(in oklch, var(--color-accent-base), transparent 88%), transparent 32%),
      linear-gradient(180deg, var(--color-background-base), var(--color-background-sunken));
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
    background: linear-gradient(180deg, var(--color-surface-base), var(--color-surface-subtle));
    box-shadow: var(--shadow-2);
  }

  .label,
  .copy {
    margin: 0;
  }

  .progress {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 4rem;
    block-size: 4rem;
    border-radius: var(--border-radius-pill);
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border-subtle);
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .icon {
    font-size: 32px;
  }

  .spinner {
    font-size: 1.75rem;
    color: var(--color-accent-base);
  }

  .copy {
    color: var(--color-text-tertiary);
  }
</style>
