<template>
  <div :class="$style.component">
    <div :class="$style.content">
      <div :class="$style.progress">
        <div
          v-if="isFailed"
          :class="$style.icon"
        >
          💀
        </div>

        <CircleSpinner
          v-else
        />
      </div>

      <div v-if="isFailed">
        Failed to connect <strong>Twitch</strong>
      </div>

      <div v-else>
        Connecting <strong>Twitch</strong>...
      </div>

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
  import { startPagePath } from '~~/constants'
  import CircleSpinner from '~/components/CircleSpinner.vue'
import PerdLink from '~/components/PerdLink.vue';

  definePageMeta({
    layout: false,
    skipAuth: true
  })

  const isFailed = useState(() => false)
  const route = useRoute()
  const { user } = useUserStore()

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

      await navigateTo(startPagePath, {
        replace: true
      })
    } catch (error) {
      isFailed.value = true
    }
  }

  onBeforeMount(() => {
    handleConnect()
  })
</script>

<style module>
  .component {
    width: 100vw;
    height: 100vh;
    display: flex;
    overflow: hidden;
    padding: var(--spacing-24);
  }

  .content {
    display: grid;
    row-gap: var(--spacing-16);
    margin: auto;
    justify-items: center;
    text-align: center;
    text-wrap: balance;
  }

  .progress {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
  }

  .icon {
    font-size: 32px;
  }
</style>
