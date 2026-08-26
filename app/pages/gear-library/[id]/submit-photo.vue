<template>
  <PageContent page-title="Submit a photo">
    <template #actions>
      <PerdLink :to="backLinkPath">
        {{ backLinkLabel }}
      </PerdLink>
    </template>

    <PagePlaceholder v-if="isGuest" emoji="🔐" title="Account required.">
      Guest accounts cannot submit photos for review. Account upgrade options will be available later.
    </PagePlaceholder>

    <PageLoadingState v-else-if="isItemLoading" title="Loading equipment item" />

    <PagePlaceholder
      v-else-if="hasItemLoadError"
      emoji="🧰"
      :title="itemLoadErrorTitle"
    >
      {{ itemLoadErrorMessage }}

      <template #actions>
        <PerdButton
          v-if="canRetryItemLoad"
          variant="secondary"
          @click="retryItemLoad"
        >
          Retry
        </PerdButton>

        <PerdLink :to="appRoutes.gearLibrary">
          Back to gear library
        </PerdLink>
      </template>
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

      <form ref="submissionForm" :class="$style.form" @submit.prevent="handleSubmit">
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
              @selection-change="handlePhotoSelection"
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
                    @change="resetSubmissionAttempt"
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
                    @change="resetSubmissionAttempt"
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
              :maxlength="limits.maxEquipmentItemPhotoSubmissionSourceUrlLength"
              name="sourceUrl"
              placeholder="https://manufacturer.example/product"
              required
              type="url"
              @update:model-value="resetSubmissionAttempt"
            />

            <label :class="$style.rightsOption">
              <input
                v-model="rightsConfirmed"
                :class="$style.choiceControl"
                :disabled="isSubmitting"
                name="rightsConfirmed"
                required
                type="checkbox"
                @change="resetSubmissionAttempt"
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
  import PageLoadingState from '~/components/PageLoadingState.vue'
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

  const {
    data: itemResponse,
    error: itemError,
    refresh: refreshItem,
    status: itemStatus
  } = await useFetch(`/api/equipment/items/${itemId}`)

  const photoPicker = useTemplateRef('photoPicker')
  const submissionForm = useTemplateRef('submissionForm')
  const confirmationStatus = useTemplateRef('confirmationStatus')
  const selectedFiles = shallowRef<File[]>([])
  const sourceType = ref<PhotoSourceType>('own')
  const sourceUrl = ref('')
  const rightsConfirmed = ref(false)
  const isSubmitting = ref(false)
  const isSubmitted = ref(false)
  const mutationMessage = ref<string | null>(null)
  const idempotencyKey = ref<string | null>(null)

  function getErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined
    }

    const statusCode = Reflect.get(error, 'statusCode')

    return typeof statusCode === 'number' ? statusCode : undefined
  }

  const isGuest = computed(() => user.value.isGuest)
  const itemName = computed(() => itemResponse.value?.name ?? '')
  const isItemLoading = computed(() => itemStatus.value === 'pending')

  const hasLoadedItem = computed(
    () => itemResponse.value !== undefined && itemResponse.value !== null
  )

  const hasItemLoadError = computed(
    () => (itemError.value !== undefined && itemError.value !== null)
      || (isItemLoading.value === false && hasLoadedItem.value === false)
  )

  const itemErrorStatus = computed(() => getErrorStatus(itemError.value))
  const isItemNotFound = computed(() => itemErrorStatus.value === 404)
  const canRetryItemLoad = computed(() => isItemNotFound.value === false)

  const itemLoadErrorTitle = computed(
    () => isItemNotFound.value ? 'Item unavailable.' : 'Could not load item.'
  )

  const itemLoadErrorMessage = computed(
    () => isItemNotFound.value
      ? 'This item cannot accept photo submissions.'
      : 'The equipment item could not be loaded. Try again.'
  )

  const isManufacturerSource = computed(() => sourceType.value === 'manufacturer')
  const selectedFile = computed(() => selectedFiles.value[0] ?? null)
  const previewUrl = useObjectUrl(selectedFile)
  const hasSelectedFile = computed(() => selectedFile.value !== null)
  const hasPreview = computed(() => previewUrl.value !== undefined)
  const selectedFilename = computed(() => selectedFile.value?.name ?? '')

  const selectedFileSize = computed(() => {
    const size = selectedFile.value?.size ?? 0
    const bytesPerKilobyte = 1000
    const bytesPerMegabyte = 1_000_000

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
    () => {
      if (
        isManufacturerSource.value
        && sourceUrl.value.trim().length > limits.maxEquipmentItemPhotoSubmissionSourceUrlLength
      ) {
        return 'Use a manufacturer URL with 2,048 characters or fewer.'
      }

      return isManufacturerUrlInvalid.value
        ? 'Use an HTTPS manufacturer URL.'
        : undefined
    }
  )

  const backLinkPath = computed(
    () => hasLoadedItem.value ? itemPath : appRoutes.gearLibrary
  )

  const backLinkLabel = computed(
    () => hasLoadedItem.value ? `Back to ${itemName.value}` : 'Back to gear library'
  )

  const isSubmitDisabled = computed(
    () => isSubmitting.value
      || selectedFile.value === null
      || rightsConfirmed.value === false
      || hasRequiredSource.value === false
      || isSelectedFileTooLarge.value
      || manufacturerUrlError.value !== undefined
  )

  function handlePhotoSelection() {
    rightsConfirmed.value = false
    idempotencyKey.value = null
    mutationMessage.value = null
  }

  function resetSubmissionAttempt() {
    idempotencyKey.value = null
    mutationMessage.value = null
  }

  async function handleRemovePhoto() {
    if (isSubmitting.value) {
      return
    }

    selectedFiles.value = []
    rightsConfirmed.value = false
    idempotencyKey.value = null
    mutationMessage.value = null

    await nextTick()

    photoPicker.value?.focus()
  }

  async function retryItemLoad() {
    await refreshItem()
  }

  async function handleSubmit() {
    if (isSubmitDisabled.value || selectedFile.value === null) {
      return
    }

    mutationMessage.value = null
    isSubmitting.value = true

    const submissionIdempotencyKey = idempotencyKey.value ?? globalThis.crypto.randomUUID()

    idempotencyKey.value = submissionIdempotencyKey

    try {
      if (submissionForm.value === null) {
        throw new Error('Photo submission form is unavailable')
      }

      const formData = new globalThis.FormData(submissionForm.value)

      formData.set('rightsConfirmed', 'true')

      if (isManufacturerSource.value) {
        formData.set('sourceUrl', sourceUrl.value.trim())
      }

      await requestFetch(`/api/equipment/items/${itemId}/photo-submissions`, {
        body: formData,

        headers: {
          'Idempotency-Key': submissionIdempotencyKey
        },

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
      } else if (statusCode === 409) {
        mutationMessage.value = 'Three photos are already awaiting review for this item.'
      } else if (statusCode === 429) {
        mutationMessage.value = 'Too many photo submission attempts. Try again in a minute.'
      } else if (statusCode === 503) {
        mutationMessage.value = 'Photo submission is temporarily unavailable. Try again.'
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
  }

  .legend {
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
