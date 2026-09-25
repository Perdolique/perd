<template>
  <NuxtImg
    v-if="usesCloudflareProvider"
    v-bind="$attrs"
    :alt="alt"
    :fit="fit"
    :height="height"
    :loading="loading"
    :preload="preload"
    provider="cloudflareimages"
    :sizes="sizes"
    :src="cloudflareImageSource"
    :width="width"
    @error="handleError"
  />

  <img
    v-else
    v-bind="$attrs"
    :alt="alt"
    :height="height"
    :loading="loading"
    :src="standardImageSource"
    :width="width"
    @error="handleError"
  >
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'

  interface Props {
    alt: string;
    cloudflareImageId: string | null;
    fit: 'contain' | 'cover' | 'inside';
    height: number;
    loading: 'eager' | 'lazy';
    preload?: boolean;
    sizes?: string;
    width: number;
  }

  const placeholderSource = '/equipment-item-placeholder.webp'

  defineOptions({ inheritAttrs: false })

  const { cloudflareImageId } = defineProps<Props>()
  const hasLoadError = ref(false)

  const hasCloudflareImage = computed(
    () => cloudflareImageId !== null && hasLoadError.value === false
  )

  const usesCloudflareProvider = computed(
    () => import.meta.dev === false && hasCloudflareImage.value
  )

  const cloudflareImageSource = computed(
    () => cloudflareImageId ?? placeholderSource
  )

  const standardImageSource = computed(() => {
    if (
      import.meta.dev
      && cloudflareImageId !== null
      && hasLoadError.value === false
    ) {
      const encodedCloudflareImageId = encodeURIComponent(cloudflareImageId)

      return `/api/equipment/images/${encodedCloudflareImageId}`
    }

    return placeholderSource
  })

  watch(() => cloudflareImageId, () => {
    hasLoadError.value = false
  })

  function handleError(): void {
    hasLoadError.value = true
  }
</script>
