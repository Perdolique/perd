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

    <div v-else-if="isSubmitted" :class="$style.confirmation">
      <p ref="confirmationStatus" role="status" tabindex="-1">
        Photo submitted for review. It will remain private until an administrator approves it.
      </p>

      <div :class="$style.actions">
        <PerdLink :to="itemPath">
          Back to item
        </PerdLink>

        <PerdLink :to="appRoutes.accountSubmissions">
          View My contributions
        </PerdLink>
      </div>
    </div>

    <form v-else :class="$style.form" @submit.prevent="handleSubmit">
      <div :class="$style.field">
        <label for="photo-file">Photo</label>

        <input
          id="photo-file"
          accept="image/jpeg,image/png,image/webp"
          :disabled="isSubmitting"
          name="photo"
          required
          type="file"
          @change="handleFileChange"
        >

        <p :class="$style.hint">
          JPEG, PNG, or WebP, up to 5 MB
        </p>

        <p v-if="selectedFilename" :class="$style.filename">
          Selected: {{ selectedFilename }}
        </p>

        <p v-if="isSelectedFileTooLarge" role="alert" :class="$style.error">
          Choose a photo that is 5 MB or smaller.
        </p>
      </div>

      <fieldset :class="$style.fieldset" :disabled="isSubmitting">
        <legend>Photo source</legend>

        <label :class="$style.option">
          <input v-model="sourceType" name="sourceType" type="radio" value="own">
          My own photo
        </label>

        <label :class="$style.option">
          <input v-model="sourceType" name="sourceType" type="radio" value="manufacturer">
          Official manufacturer photo
        </label>
      </fieldset>

      <div v-if="isManufacturerSource" :class="$style.field">
        <label for="photo-source-url">Manufacturer source</label>

        <input
          id="photo-source-url"
          v-model="sourceUrl"
          :disabled="isSubmitting"
          name="sourceUrl"
          placeholder="https://manufacturer.example/product"
          required
          type="url"
        >

        <p v-if="isManufacturerUrlInvalid" role="alert" :class="$style.error">
          Use an HTTPS manufacturer URL.
        </p>
      </div>

      <label :class="$style.option">
        <input
          v-model="rightsConfirmed"
          :disabled="isSubmitting"
          name="rightsConfirmed"
          required
          type="checkbox"
        >
        I confirm that this photo can be published in the catalog.
      </label>

      <p v-if="mutationMessage" role="alert" :class="$style.error">
        {{ mutationMessage }}
      </p>

      <PerdButton :disabled="isSubmitDisabled" :loading="isSubmitting" type="submit">
        Submit photo
      </PerdButton>
    </form>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, shallowRef, useTemplateRef } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute, useUserStore } from '#imports'
  import { limits } from '#shared/constants'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
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
  const confirmationStatus = useTemplateRef('confirmationStatus')
  const selectedFile = shallowRef<File | null>(null)
  const sourceType = ref<PhotoSourceType>('own')
  const sourceUrl = ref('')
  const rightsConfirmed = ref(false)
  const isSubmitting = ref(false)
  const isSubmitted = ref(false)
  const mutationMessage = ref<string | null>(null)
  const isGuest = computed(() => user.value.isGuest)
  const isManufacturerSource = computed(() => sourceType.value === 'manufacturer')
  const selectedFilename = computed(() => selectedFile.value?.name ?? '')
  const hasRequiredSource = computed(() => isManufacturerSource.value === false || sourceUrl.value.trim() !== '')

  const isSelectedFileTooLarge = computed(
    () => (selectedFile.value?.size ?? 0) > limits.maxEquipmentItemImageByteLength
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

  const backLinkLabel = computed(() => `Back to ${itemResponse.value?.name ?? 'item'}`)

  const isSubmitDisabled = computed(
    () => isSubmitting.value
      || selectedFile.value === null
      || rightsConfirmed.value === false
      || hasRequiredSource.value === false
      || isSelectedFileTooLarge.value
      || isManufacturerUrlInvalid.value
  )

  function handleFileChange(event: Event) {
    const input = event.currentTarget

    if (input instanceof globalThis.HTMLInputElement) {
      selectedFile.value = input.files?.item(0) ?? null
    }
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
  .form,
  .confirmation,
  .field {
    display: grid;
    gap: var(--spacing-12);
  }

  .form,
  .confirmation {
    max-inline-size: 44rem;
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
  }

  .fieldset {
    display: grid;
    gap: var(--spacing-12);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-12);
  }

  .option {
    display: flex;
    align-items: start;
    gap: var(--spacing-8);
  }

  .hint,
  .filename {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-14);
  }

  .error {
    color: var(--color-danger-primary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-12);
  }
</style>
