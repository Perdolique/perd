<template>
  <section
    ref="gallery"
    :class="$style.component"
    :aria-label="galleryLabel"
    tabindex="-1"
  >
    <div :class="$style.imageFrame">
      <EquipmentItemImage
        :key="displayedImageKey"
        :class="$style.image"
        :alt="itemName"
        :cloudflare-image-id="displayedImageId"
        fit="inside"
        :height="660"
        loading="eager"
        :preload="preloadPrimaryImage"
        sizes="sm:100vw lg:440px"
        :width="880"
        @error="handleImageError"
        @load="handleImageLoad"
      />
    </div>

    <p :class="$style.status" role="status" aria-live="polite" aria-atomic="true">
      {{ galleryStatusMessage }}
    </p>

    <PerdButton
      v-if="showRetry"
      :class="$style.retry"
      :loading="isRetrying"
      variant="secondary"
      @click="handleRetry"
    >
      Retry
    </PerdButton>

    <div v-if="hasMultipleImages" :class="$style.thumbnails">
      <button
        v-for="image in imageViews"
        :key="image.id"
        :class="[$style.thumbnailButton, { selected: image.isSelected }]"
        :aria-label="image.label"
        :aria-pressed="image.isSelected"
        type="button"
        @click="handleSelect(image.id)"
      >
        <EquipmentItemImage
          :class="$style.thumbnail"
          alt=""
          :cloudflare-image-id="image.cloudflareImageId"
          fit="cover"
          :height="64"
          loading="lazy"
          :width="64"
        />
      </button>
    </div>
  </section>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
  import { useFetch } from '#imports'
  import EquipmentItemImage from '~/components/equipment/EquipmentItemImage.vue'
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    itemId: string;
    itemName: string;
    primaryImageId: string | null;
  }

  const { itemId, itemName, primaryImageId } = defineProps<Props>()
  const gallery = useTemplateRef('gallery')
  const selectedImageId = ref<string | null>(null)
  const isRetryingGallery = ref(false)
  const isRetryingImage = ref(false)
  const hasImageLoadError = ref(false)
  const imageRetryCount = ref(0)
  let retryTrigger: EventTarget | null = null

  const {
    clear: clearGallery,
    data: imagesResponse,
    error: imagesError,
    refresh: refreshImages,
    status: imagesStatus
  } = useFetch(`/api/equipment/items/${itemId}/gallery`, {
    key: `equipment-item-gallery:${itemId}`,
    lazy: true,
    server: false
  })

  const galleryLabel = computed(() => `Photos of ${itemName}`)
  const images = computed(() => imagesResponse.value ?? [])
  const selectedImage = computed(() => images.value.find(image => image.id === selectedImageId.value) ?? images.value[0])

  const displayedImageId = computed(() => {
    if (imagesResponse.value === undefined || imagesResponse.value === null) {
      return primaryImageId
    }

    return selectedImage.value?.cloudflareImageId ?? null
  })

  const displayedImageKey = computed(() => `${displayedImageId.value ?? 'placeholder'}:${imageRetryCount.value}`)
  const preloadPrimaryImage = computed(() => primaryImageId !== null && displayedImageId.value === primaryImageId)
  const hasMultipleImages = computed(() => images.value.length > 1)
  const hasLoadError = computed(() => imagesError.value !== undefined && imagesError.value !== null)
  const isLoading = computed(() => imagesStatus.value === 'idle' || imagesStatus.value === 'pending')
  const isRetrying = computed(() => isRetryingGallery.value || isRetryingImage.value)
  const showRetry = computed(() => hasLoadError.value || hasImageLoadError.value || isRetrying.value)

  const imageViews = computed(() => images.value.map((image, index) => {
    const position = index + 1

    return {
      cloudflareImageId: image.cloudflareImageId,
      id: image.id,
      isSelected: image.id === selectedImage.value?.id,
      label: `View photo ${position} of ${images.value.length}`
    }
  }))

  const galleryStatusMessage = computed(() => {
    if (isRetryingGallery.value) {
      return 'Retrying photos.'
    }

    if (isRetryingImage.value) {
      return 'Retrying photo.'
    }

    if (isLoading.value) {
      return 'Loading photos.'
    }

    if (hasLoadError.value) {
      return 'Could not load photos. Try again.'
    }

    if (hasImageLoadError.value) {
      return 'Could not load this photo. Try again.'
    }

    if (images.value.length === 0) {
      return 'No photos yet.'
    }

    if (hasMultipleImages.value) {
      const position = images.value.findIndex(image => image.id === selectedImage.value?.id) + 1

      return `Photo ${position} of ${images.value.length}`
    }

    return ''
  })

  onScopeDispose(clearGallery)

  watch(displayedImageId, () => {
    hasImageLoadError.value = false
    isRetryingImage.value = false
  })

  watch(showRetry, async (visible) => {
    if (visible || globalThis.document.activeElement !== retryTrigger) {
      return
    }

    await nextTick()

    if (globalThis.document.activeElement === globalThis.document.body) {
      gallery.value?.focus()
    }
  })

  function handleSelect(imageId: string) {
    selectedImageId.value = imageId
  }

  function handleImageError() {
    hasImageLoadError.value = true
    isRetryingImage.value = false
  }

  function handleImageLoad() {
    isRetryingImage.value = false
  }

  async function handleRetry(event: MouseEvent) {
    if (isRetrying.value) {
      return
    }

    retryTrigger = event.currentTarget

    if (!hasLoadError.value && hasImageLoadError.value) {
      hasImageLoadError.value = false
      isRetryingImage.value = true
      imageRetryCount.value += 1

      return
    }

    isRetryingGallery.value = true

    try {
      await refreshImages()
    } finally {
      isRetryingGallery.value = false
    }
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-12);
    min-inline-size: 0;
    border-radius: var(--border-radius-16);

    &:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 4px;
    }
  }

  .imageFrame {
    overflow: hidden;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
  }

  .image {
    inline-size: 100%;
    block-size: clamp(14rem, 30cqi, 19rem);
    object-fit: contain;
  }

  .status {
    min-block-size: 1.5em;
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
  }

  .retry {
    justify-self: start;
  }

  .thumbnails {
    display: flex;
    gap: var(--spacing-8);
    overflow-x: auto;
    padding: var(--spacing-4);
  }

  .thumbnailButton {
    flex: 0 0 auto;
    padding: 0;
    border: 2px solid transparent;
    border-radius: var(--border-radius-6);
    background-color: var(--color-surface-secondary);
    cursor: pointer;

    &:hover {
      border-color: var(--color-border-strong);
    }

    &:global(.selected) {
      border-color: var(--color-accent-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }
  }

  .thumbnail {
    border-radius: var(--border-radius-6);
    object-fit: cover;
  }
</style>
