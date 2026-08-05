<template>
  <NuxtImg
    v-if="hasCloudflareImage"
    v-bind="$attrs"
    :alt="alt"
    :fit="fit"
    :height="height"
    :loading="loading"
    :preload="preload"
    provider="cloudflareimages"
    :sizes="sizes"
    :src="imageSource"
    :width="width"
    @error="handleError"
  />

  <img
    v-else
    v-bind="$attrs"
    :alt="alt"
    :height="height"
    :loading="loading"
    :src="placeholderSource"
    :width="width"
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

  const props = defineProps<Props>()
  const hasLoadError = ref(false)

  const hasCloudflareImage = computed(
    () => props.cloudflareImageId !== null && hasLoadError.value === false
  )

  const imageSource = computed(() => props.cloudflareImageId ?? placeholderSource)

  watch(() => props.cloudflareImageId, () => {
    hasLoadError.value = false
  })

  function handleError(): void {
    hasLoadError.value = true
  }
</script>
