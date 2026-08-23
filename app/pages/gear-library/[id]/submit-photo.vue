<template>
  <PageContent page-title="Submit a photo">
    <template #actions>
      <PerdLink :to="itemPath">
        {{ backLinkLabel }}
      </PerdLink>
    </template>

    <PagePlaceholder v-if="isGuest" emoji="🔐" title="Account required.">
      Guest accounts cannot submit photos for review. Account upgrade options will be available later.
    </PagePlaceholder>

    <PagePlaceholder
      v-else-if="isSubmitted"
      emoji="✅"
      title="Photo submitted."
    >
      <p ref="confirmationStatus" role="status" tabindex="-1">
        Your photo is pending review and will remain private until an administrator approves it.
      </p>

      <template #actions>
        <PerdLink :to="itemPath">
          Back to item
        </PerdLink>

        <PerdLink :to="appRoutes.accountSubmissions">
          View My contributions
        </PerdLink>
      </template>
    </PagePlaceholder>

    <PerdCard v-else :class="$style.card" padding="large">
      <div :class="$style.introduction">
        <h2 :class="$style.itemTitle">
          Photo for {{ itemName }}
        </h2>

        <p :class="$style.privacyNote">
          The photo stays private while an administrator reviews it for the catalog.
        </p>
      </div>

      <form :class="$style.form" @submit.prevent="handleSubmit">
        <div :class="$style.formGrid">
          <section :class="$style.uploadSection">
            <h3 :class="$style.sectionTitle">
              Photo
            </h3>

            <EquipmentImageFilePicker
              ref="photoPicker"
              v-model="selectedFiles"
              :disabled="isSubmitting"
              :error="selectedFileError"
              label="Photo"
              name="photo"
              required
              @update:model-value="handlePhotoSelection"
            >
              <template #selection>
                <div :class="$style.preview">
                  <img
                    v-if="hasPreview"
                    :alt="previewAlt"
                    :class="$style.previewImage"
                    :src="previewUrl"
                  >

                  <div :class="$style.fileDetails">
                    <span :class="$style.filename">{{ selectedFilename }}</span>
                    <span :class="$style.fileSize">{{ selectedFileSize }}</span>
                  </div>
                </div>
              </template>
            </EquipmentImageFilePicker>

            <PerdButton
              v-if="hasSelectedFile"
              :disabled="isSubmitting"
              icon="hugeicons:delete-02"
              variant="secondary"
              @click="handleRemovePhoto"
            >
              Remove photo
            </PerdButton>
          </section>

          <section :class="$style.detailsSection">
            <h3 :class="$style.sectionTitle">
              Photo details
            </h3>

            <fieldset :class="$style.sourceFieldset" :disabled="isSubmitting">
              <legend :class="$style.legend">
                Photo source
              </legend>

              <div :class="$style.sourceOptions">
                <label :class="$style.sourceOption">
                  <input
                    v-model="sourceType"
                    :class="$style.choiceControl"
                    name="sourceType"
                    type="radio"
                    value="own"
                  >

                  <span :class="$style.optionBody">
                    <span :class="$style.optionTitle">My own photo</span>
                    <span :class="$style.optionDescription">A photo you took yourself.</span>
                  </span>
                </label>

                <label :class="$style.sourceOption">
                  <input
                    v-model="sourceType"
                    :class="$style.choiceControl"
                    name="sourceType"
                    type="radio"
                    value="manufacturer"
                  >

                  <span :class="$style.optionBody">
                    <span :class="$style.optionTitle">Official manufacturer photo</span>
                    <span :class="$style.optionDescription">A public product image from the maker.</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <TextInput
              v-if="isManufacturerSource"
              v-model="sourceUrl"
              autocomplete="url"
              :disabled="isSubmitting"
              :error="manufacturerUrlError"
              hint="Link to the original image or product page."
              label="Manufacturer source"
              name="sourceUrl"
              placeholder="https://manufacturer.example/product"
              required
              type="url"
            />

            <label :class="$style.rightsOption">
              <input
                v-model="rightsConfirmed"
                :class="$style.choiceControl"
                :disabled="isSubmitting"
                name="rightsConfirmed"
                required
                type="checkbox"
              >

              <span :class="$style.optionBody">
                <span :class="$style.optionTitle">I have permission to share this photo</span>
                <span :class="$style.optionDescription">
                  I confirm that this photo can be published in the catalog.
                </span>
              </span>
            </label>
          </section>
        </div>

        <p v-if="hasMutationMessage" role="alert" :class="$style.mutationAlert">
          {{ mutationMessage }}
        </p>

        <div :class="$style.actions">
          <PerdButton
            :class="$style.submitButton"
            :disabled="isSubmitDisabled"
            :loading="isSubmitting"
            type="submit"
          >
            Submit photo
          </PerdButton>
        </div>
      </form>
    </PerdCard>
  </PageContent>
</template>

<script lang="ts" setup>
  import { useObjectUrl } from '@vueuse/core'
  import { computed, nextTick, ref, shallowRef, useTemplateRef } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute, useUserStore } from '#imports'
  import { limits } from '#shared/constants'
  import EquipmentImageFilePicker from '~/components/equipment/EquipmentImageFilePicker.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import TextInput from '~/components/TextInput.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes, createGearLibraryItemPath } from '~/utils/navigation'

  type PhotoSourceType = 'manufacturer' | 'own'

  definePageMeta({ layout: 'page' })

  const route = useRoute()

  const itemId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id ?? ''

  const itemPath = createGearLibraryItemPath(itemId)
  const requestFetch = useRequestFetch()
  const { user } = useUserStore()
  const { data: itemResponse } = await useFetch(`/api/equipment/items/${itemId}`)
  const photoPicker = useTemplateRef('photoPicker')
  const confirmationStatus = useTemplateRef('confirmationStatus')
  const selectedFiles = shallowRef<File[]>([])
  const sourceType = ref<PhotoSourceType>('own')
  const sourceUrl = ref('')
  const rightsConfirmed = ref(false)
  const isSubmitting = ref(false)
  const isSubmitted = ref(false)
  const mutationMessage = ref<string | null>(null)
  const isGuest = computed(() => user.value.isGuest)
  const itemName = computed(() => itemResponse.value?.name ?? 'this item')
  const isManufacturerSource = computed(() => sourceType.value === 'manufacturer')
  const selectedFile = computed(() => selectedFiles.value[0] ?? null)
  const previewUrl = useObjectUrl(selectedFile)
  const hasSelectedFile = computed(() => selectedFile.value !== null)
  const hasPreview = computed(() => previewUrl.value !== undefined)
  const selectedFilename = computed(() => selectedFile.value?.name ?? '')

  const selectedFileSize = computed(() => {
    const size = selectedFile.value?.size ?? 0
    const bytesPerKilobyte = 1024
    const bytesPerMegabyte = bytesPerKilobyte * bytesPerKilobyte

    if (size < bytesPerKilobyte) {
      return `${size} B`
    }

    if (size < bytesPerMegabyte) {
      return `${(size / bytesPerKilobyte).toFixed(1)} KB`
    }

    return `${(size / bytesPerMegabyte).toFixed(1)} MB`
  })

  const previewAlt = computed(() => `Preview of ${selectedFilename.value}`)
  const hasRequiredSource = computed(() => isManufacturerSource.value === false || sourceUrl.value.trim() !== '')
  const hasMutationMessage = computed(() => mutationMessage.value !== null)

  const isSelectedFileTooLarge = computed(
    () => (selectedFile.value?.size ?? 0) > limits.maxEquipmentItemImageByteLength
  )

  const selectedFileError = computed(
    () => isSelectedFileTooLarge.value
      ? 'Choose a photo that is 5 MB or smaller.'
      : undefined
  )

  const isManufacturerUrlInvalid = computed(() => {
    if (isManufacturerSource.value === false || sourceUrl.value.trim() === '') {
      return false
    }

    try {
      return new globalThis.URL(sourceUrl.value.trim()).protocol !== 'https:'
    } catch {
      return true
    }
  })

  const manufacturerUrlError = computed(
    () => isManufacturerUrlInvalid.value
      ? 'Use an HTTPS manufacturer URL.'
      : undefined
  )

  const backLinkLabel = computed(() => `Back to ${itemName.value}`)

  const isSubmitDisabled = computed(
    () => isSubmitting.value
      || selectedFile.value === null
      || rightsConfirmed.value === false
      || hasRequiredSource.value === false
      || isSelectedFileTooLarge.value
      || isManufacturerUrlInvalid.value
  )

  function handlePhotoSelection() {
    mutationMessage.value = null
  }

  async function handleRemovePhoto() {
    if (isSubmitting.value) {
      return
    }

    selectedFiles.value = []
    mutationMessage.value = null

    await nextTick()

    photoPicker.value?.focus()
  }

  function getErrorStatus(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return null
    }

    const statusCode = Reflect.get(error, 'statusCode')

    return typeof statusCode === 'number' ? statusCode : null
  }

  async function handleSubmit() {
    if (isSubmitDisabled.value || selectedFile.value === null) {
      return
    }

    mutationMessage.value = null
    isSubmitting.value = true

    const selectedPhoto = selectedFile.value

    try {
      const photoBytes = await selectedPhoto.arrayBuffer()

      const photo = new globalThis.File([photoBytes], selectedPhoto.name, {
        lastModified: selectedPhoto.lastModified,
        type: selectedPhoto.type
      })

      const formData = new globalThis.FormData()

      formData.append('photo', photo)
      formData.append('rightsConfirmed', 'true')
      formData.append('sourceType', sourceType.value)

      if (isManufacturerSource.value) {
        formData.append('sourceUrl', sourceUrl.value.trim())
      }

      await requestFetch(`/api/equipment/items/${itemId}/photo-submissions`, {
        body: formData,
        method: 'POST'
      })
      isSubmitted.value = true

      await nextTick()

      confirmationStatus.value?.focus()
    } catch (error) {
      const statusCode = getErrorStatus(error)

      if (statusCode === 413) {
        mutationMessage.value = 'Choose a photo that is 5 MB or smaller.'
      } else if (statusCode === 415) {
        mutationMessage.value = 'Choose a valid JPEG, PNG, or WebP image.'
      } else {
        mutationMessage.value = 'Could not submit photo. Try again.'
      }
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<style module>
  .card {
    display: grid;
    gap: var(--spacing-24);
    container-type: inline-size;
  }

  .introduction,
  .form,
  .uploadSection,
  .detailsSection {
    display: grid;
    align-content: start;
    gap: var(--spacing-16);
  }

  .introduction {
    padding-block-end: var(--spacing-20);
    border-block-end: 1px solid var(--color-border-subtle);
  }

  .itemTitle {
    color: var(--color-text-primary);
    font-size: var(--font-size-24);
    line-height: var(--line-height-tight);
  }

  .privacyNote {
    max-inline-size: 44rem;
    color: var(--color-text-tertiary);
  }

  .formGrid {
    display: grid;
    gap: var(--spacing-32);
  }

  .sectionTitle {
    color: var(--color-text-primary);
    font-size: var(--font-size-20);
    line-height: var(--line-height-snug);
  }

  .preview {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-block-size: 12rem;
    background-color: var(--color-surface-primary);
  }

  .previewImage {
    inline-size: 100%;
    block-size: 100%;
    max-block-size: 24rem;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }

  .fileDetails {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    padding: var(--spacing-12) var(--spacing-16);
    border-block-start: 1px solid var(--color-border-subtle);
  }

  .filename {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    color: var(--color-text-primary);
    font-weight: var(--font-weight-semibold);
  }

  .fileSize {
    flex: none;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-14);
  }

  .sourceFieldset {
    display: grid;
    gap: var(--spacing-12);
    padding: 0;
    border: 0;
  }

  .legend {
    padding: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .sourceOptions {
    display: grid;
    gap: var(--spacing-8);
  }

  .sourceOption,
  .rightsOption {
    display: flex;
    align-items: start;
    gap: var(--spacing-12);
    min-block-size: var(--layout-touch-target);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover {
      border-color: var(--color-border-strong);
      background-color: var(--color-surface-tertiary);
    }

    &:has(.choiceControl:focus-visible) {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
    }

    &:has(.choiceControl:checked) {
      border-color: var(--color-accent-subtle-border);
      background-color: var(--color-accent-subtle);

      &:hover {
        background-color: var(--color-accent-subtle-hover);
      }
    }

    &:has(.choiceControl:disabled) {
      cursor: not-allowed;
      opacity: 0.65;

      &:hover {
        border-color: var(--color-border-subtle);
        background-color: var(--color-surface-secondary);
      }
    }
  }

  .choiceControl {
    flex: none;
    inline-size: 1.125rem;
    block-size: 1.125rem;
    margin-block-start: 0.125rem;
    accent-color: var(--color-accent-primary);

    &:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }
  }

  .optionBody {
    display: grid;
    gap: var(--spacing-4);
  }

  .optionTitle {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-semibold);
  }

  .optionDescription {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-14);
  }

  .mutationAlert {
    padding: var(--spacing-12) var(--spacing-16);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--border-radius-12);
    background-color: var(--color-danger-subtle);
    color: var(--color-danger-primary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .submitButton {
    inline-size: 100%;
  }

  @container (min-width: 48rem) {
    .formGrid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .sourceOptions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .submitButton {
      inline-size: auto;
    }
  }

  @media (forced-colors: active) {
    .choiceControl:focus {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
