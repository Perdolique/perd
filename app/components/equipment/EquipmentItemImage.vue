<template>
  <NuxtImg
    v-if="usesCloudflareProvider"
    v-bind="$attrs"
    :alt="imageAlt"
    :fit="fit"
    :height="height"
    :loading="loading"
    :preload="preload"
    provider="cloudflareimages"
    :sizes="sizes"
    :src="cloudflareImageSource"
    :width="width"
    @error="handleError"
    @load="handleLoad"
  />

  <img
    v-else
    v-bind="$attrs"
    :alt="imageAlt"
    :height="height"
    :loading="loading"
    :src="standardImageSource"
    :width="width"
    @error="handleError"
    @load="handleLoad"
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

  interface Emits {
    error: [error: Event | string];
    load: [event: Event];
  }

  defineOptions({ inheritAttrs: false })

  const { alt, cloudflareImageId } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const placeholderSource = '/equipment-item-placeholder.webp'
  const hasLoadError = ref(false)

  const hasCloudflareImage = computed(
    () => cloudflareImageId !== null && hasLoadError.value === false
  )

  const imageAlt = computed(() => hasCloudflareImage.value ? alt : '')

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

  function handleError(error: Event | string): void {
    if (!hasCloudflareImage.value) {
      return
    }

    hasLoadError.value = true

    emit('error', error)
  }

  function handleLoad(event: Event): void {
    if (hasCloudflareImage.value) {
      emit('load', event)
    }
  }
</script>
