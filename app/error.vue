<template>
  <main :class="$style.component">
    <PerdHeading :level="1">{{ statusCode }}</PerdHeading>
    <p>{{ message }}</p>
    <PerdButton @click="returnHome">Go back home</PerdButton>
  </main>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { NuxtError } from '#app'
  import { clearError, useHead, useRouter } from '#imports'
  import { appLocations } from '~/utils/navigation'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    error: NuxtError;
  }

  const { error } = defineProps<Props>()
  const router = useRouter()
  const statusCode = computed(() => error.statusCode)

  const message = computed(() => statusCode.value === 404
    ? 'Page not found.'
    : 'This page is unavailable. Try again later.')

  useHead({ title: () => `${statusCode.value} - ${message.value} | Perd` })

  async function returnHome() {
    const { fullPath } = router.resolve(appLocations.home)

    await clearError({ redirect: fullPath })
  }
</script>

<style module>
  .component {
    min-block-size: 100dvh;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: var(--spacing-16);
    padding: var(--spacing-24);
    text-align: center;
  }
</style>
