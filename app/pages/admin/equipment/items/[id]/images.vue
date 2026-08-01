<template>
  <PageContent page-title="Equipment images">
    <template #actions>
      <PerdButton
        :disabled="isUploadDisabled"
        icon="hugeicons:upload-02"
        :loading="isUploading"
        size="small"
        @click="handleUpload"
      >
        Upload
      </PerdButton>
    </template>

    <div :class="$style.component">
      <PerdCard padding="large">
        <label :class="$style.filePicker">
          <span :class="$style.filePickerLabel">Choose images</span>
          <span :class="$style.filePickerValue">{{ selectedFilesText }}</span>

          <input
            ref="fileInput"
            :class="$style.fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            @change="handleFileSelection"
          >
        </label>

        <p :class="$style.helpText">
          Select one or more JPEG, PNG, or WebP images. They are added in selection order.
        </p>
      </PerdCard>

      <p
        v-if="hasMutationError"
        :class="$style.errorMessage"
        role="alert"
      >
        {{ mutationErrorMessage }}
      </p>

      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading equipment images"
      />

      <PagePlaceholder
        v-else-if="hasLoadError"
        emoji="🖼️"
        title="Equipment images unavailable."
      >
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder
        v-else-if="isEmpty"
        emoji="🖼️"
        title="No images yet."
      >
        Choose images above to add the first picture.
      </PagePlaceholder>

      <div
        v-else
        :class="$style.gallery"
        :aria-busy="isGalleryBusy"
      >
        <PerdCard
          v-for="image in imageViews"
          :key="image.id"
          :class="$style.imageCard"
          padding="none"
          :draggable="canDragImages"
          @dragend="handleDragEnd"
          @dragstart="handleDragStart(image.id)"
          @dragover.prevent
          @drop="handleDrop(image.id)"
        >
          <img
            :src="image.previewUrl"
            :alt="image.altText"
            :class="$style.image"
          >

          <div :class="$style.imageFooter">
            <span
              v-if="image.isPrimary"
              :class="$style.primaryBadge"
            >
              Primary
            </span>

            <PerdButton
              :aria-label="image.deleteLabel"
              :disabled="isDeleteDisabled"
              icon="hugeicons:delete-02"
              :loading="image.isDeleting"
              size="small"
              variant="danger"
              @click="handleDelete(image.id)"
            >
              Delete
            </PerdButton>
          </div>
        </PerdCard>

        <p
          v-if="isGalleryBusy"
          :class="$style.visuallyHidden"
          role="status"
          aria-live="polite"
        >
          {{ galleryStatusMessage }}
        </p>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute } from '#imports'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const requestFetch = useRequestFetch()
  const fileInput = useTemplateRef('fileInput')
  const routeItemId = route.params.id
  const itemId = Array.isArray(routeItemId)
    ? routeItemId[0] ?? ''
    : routeItemId ?? ''

  const imagesPath = `/api/equipment/items/${itemId}/images` as const
  const imageOrderPath = `${imagesPath}/order` as const

  const {
    data: imagesResponse,
    error: imagesError,
    refresh: refreshImages,
    status: imagesStatus
  } = await useFetch(imagesPath, {
    default: () => []
  })

  const selectedFiles = ref<File[]>([])
  const mutationErrorMessage = ref<string | null>(null)
  const draggedImageId = ref<string | null>(null)
  const deletingImageId = ref<string | null>(null)
  const isReordering = ref(false)
  const isUploading = ref(false)

  const hasLoadError = computed(() => imagesError.value !== undefined)
  const hasMutationError = computed(() => mutationErrorMessage.value !== null)
  const isEmpty = computed(() => imagesResponse.value.length === 0)
  const isInitialLoading = computed(() => imagesStatus.value === 'pending')
  const isDeleting = computed(() => deletingImageId.value !== null)
  const isGalleryBusy = computed(() => isDeleting.value || isReordering.value)
  const canDragImages = computed(() => isGalleryBusy.value === false)
  const isDeleteDisabled = computed(() => isGalleryBusy.value)

  const galleryStatusMessage = computed(
    () => isDeleting.value ? 'Deleting equipment image' : 'Saving image order'
  )

  const isUploadDisabled = computed(
    () => selectedFiles.value.length === 0 || isUploading.value
  )

  const selectedFilesText = computed(() => {
    const fileCount = selectedFiles.value.length

    if (fileCount === 0) {
      return 'No files selected'
    }

    const fileLabel = fileCount === 1 ? 'file' : 'files'

    return `${fileCount} ${fileLabel} selected`
  })

  const imageViews = computed(() => imagesResponse.value.map((image, index) => {
    const position = index + 1

    return {
      altText: `Equipment image ${position}`,
      deleteLabel: `Delete equipment image ${position}`,
      id: image.id,
      isDeleting: deletingImageId.value === image.id,
      isPrimary: index === 0,
      previewUrl: image.previewUrl
    }
  }))

  function handleFileSelection() {
    const files = fileInput.value?.files

    selectedFiles.value = files === null || files === undefined
      ? []
      : [...files]

    mutationErrorMessage.value = null
  }

  async function handleRetry() {
    mutationErrorMessage.value = null

    await refreshImages()
  }

  async function handleUpload() {
    if (isUploadDisabled.value) {
      return
    }

    isUploading.value = true
    mutationErrorMessage.value = null
    let uploadedFileCount = 0

    try {
      for (const file of selectedFiles.value) {
        // oxlint-disable-next-line no-await-in-loop -- Each response determines the next dense displayOrder.
        await requestFetch(imagesPath, {
          body: file,
          headers: {
            'content-type': file.type
          },
          method: 'POST'
        })

        uploadedFileCount += 1
      }
    } catch {
      mutationErrorMessage.value = 'Could not upload all selected images.'
    } finally {
      selectedFiles.value = selectedFiles.value.slice(uploadedFileCount)
      isUploading.value = false

      if (selectedFiles.value.length === 0 && fileInput.value !== null) {
        fileInput.value.value = ''
      }
    }

    await refreshImages()
  }

  function handleDragStart(imageId: string) {
    if (isReordering.value) {
      return
    }

    draggedImageId.value = imageId
    mutationErrorMessage.value = null
  }

  function handleDragEnd() {
    draggedImageId.value = null
  }

  async function handleDelete(imageId: string) {
    if (isDeleteDisabled.value) {
      return
    }

    deletingImageId.value = imageId
    mutationErrorMessage.value = null
    const imagePath = `${imagesPath}/${imageId}` as const

    try {
      await requestFetch(imagePath, {
        method: 'DELETE'
      })
    } catch {
      mutationErrorMessage.value = 'Could not delete the image.'
    } finally {
      deletingImageId.value = null
    }

    await refreshImages()
  }

  async function handleDrop(targetImageId: string) {
    const sourceImageId = draggedImageId.value

    handleDragEnd()

    if (sourceImageId === null || sourceImageId === targetImageId || isReordering.value) {
      return
    }

    const sourceIndex = imagesResponse.value.findIndex((image) => image.id === sourceImageId)
    const targetIndex = imagesResponse.value.findIndex((image) => image.id === targetImageId)

    if (sourceIndex === -1 || targetIndex === -1) {
      return
    }

    const previousImages = [...imagesResponse.value]
    const reorderedImages = [...imagesResponse.value]
    const [movedImage] = reorderedImages.splice(sourceIndex, 1)

    if (movedImage === undefined) {
      return
    }

    reorderedImages.splice(targetIndex, 0, movedImage)
    imagesResponse.value = reorderedImages
    isReordering.value = true

    const imageIds = reorderedImages.map((image) => image.id)

    try {
      await requestFetch(imageOrderPath, {
        body: {
          imageIds
        },
        method: 'PATCH'
      })
    } catch {
      imagesResponse.value = previousImages
      mutationErrorMessage.value = 'Could not save the image order.'
    } finally {
      isReordering.value = false
    }

    await refreshImages()
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
    container-type: inline-size;
  }

  .filePicker {
    display: grid;
    gap: var(--spacing-8);
    padding: var(--spacing-16);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background: var(--color-surface-secondary);
    cursor: pointer;

    &:focus-within {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
    }
  }

  .filePickerLabel {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-semibold);
  }

  .filePickerValue,
  .helpText {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-14);
  }

  .fileInput {
    inline-size: 100%;
  }

  .helpText {
    margin-block-start: var(--spacing-12);
  }

  .errorMessage {
    padding: var(--spacing-12) var(--spacing-16);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--border-radius-12);
    background: var(--color-danger-subtle);
    color: var(--color-danger-primary);
  }

  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: var(--spacing-16);
  }

  .imageCard {
    overflow: hidden;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  .image {
    display: block;
    inline-size: 100%;
    aspect-ratio: 1;
    object-fit: cover;
  }

  .imageFooter {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-12);
    padding: var(--spacing-12);
  }

  .primaryBadge {
    margin-inline-end: auto;
    padding: var(--spacing-4) var(--spacing-8);
    border-radius: var(--border-radius-6);
    background: var(--color-accent-subtle);
    color: var(--color-accent-primary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
    text-align: center;
  }

  .visuallyHidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    border: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @container (min-width: 48rem) {
    .gallery {
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    }
  }
</style>
