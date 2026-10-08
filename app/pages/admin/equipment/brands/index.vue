<template>
  <PageContent page-title="Manage brands">
    <template #actions>
      <PerdLink :to="appLocations.admin">Back to Admin</PerdLink>
    </template>

    <main :class="$style.component">
      <div :class="$style.toolbar">
        <label :class="$style.searchField">
          <span>Search brands</span>
          <input
            ref="searchInput"
            v-model="search"
            type="search"
            autocomplete="off"
            placeholder="Search by name"
            :class="$style.input"
          >
        </label>

        <PerdButton ref="createButton" :disabled="isLoading" @click="openCreate">Add brand</PerdButton>
      </div>

      <p :class="$style.announcement" role="status" aria-live="polite" aria-atomic="true">
        {{ announcement }}
      </p>

      <PageLoadingState v-if="isLoading" title="Loading brands" />

      <PagePlaceholder v-else-if="hasLoadError" emoji="🧰" title="Brands unavailable.">
        The brand list could not be loaded.
        <template #actions>
          <PerdButton variant="secondary" @click="retryLoad">Retry</PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🏷️" title="No brands yet.">
        Add the first brand to make it available in gear submissions.
      </PagePlaceholder>

      <PagePlaceholder v-else-if="hasNoMatches" emoji="🔎" title="No matching brands.">
        Try a different name.
      </PagePlaceholder>

      <ul v-else :class="$style.list">
        <li v-for="brand in visibleBrands" :key="brand.id" :class="$style.row">
          <div :class="$style.brand">
            <strong :class="$style.name">{{ brand.name }}</strong>
            <span :class="$style.slug">{{ brand.slug }}</span>
          </div>

          <div :class="$style.rowActions">
            <PerdButton size="small" variant="secondary" :aria-label="brand.editLabel" @click="openEdit(brand)">
              Edit
            </PerdButton>
            <PerdButton size="small" variant="danger" :aria-label="brand.deleteLabel" @click="openDelete(brand)">
              Delete
            </PerdButton>
          </div>
        </li>
      </ul>
    </main>

    <ModalDialog
      v-model="isFormOpen"
      :class="$style.dialog"
      :aria-labelledby="formHeadingId"
      :close-disabled="isSaving"
    >
      <form :class="$style.dialogContent" @submit.prevent="saveBrand">
        <h2 :id="formHeadingId">{{ formHeading }}</h2>

        <div :class="$style.field">
          <label :for="nameInputId">Name</label>
          <input
            :id="nameInputId"
            ref="nameInput"
            v-model="formName"
            :class="$style.input"
            :aria-invalid="nameInvalid"
            :aria-describedby="nameDescription"
            name="name"
            required
            :maxlength="limits.maxBrandNameLength"
            :disabled="isSaving"
            autocomplete="off"
            @input="resetFormErrors('name')"
          >
          <p v-if="nameInvalid" :id="formErrorId" :class="$style.error" role="alert">{{ formError }}</p>
        </div>

        <div :class="$style.field">
          <label :for="slugInputId">Slug</label>
          <input
            :id="slugInputId"
            ref="slugInput"
            v-model="formSlug"
            :class="$style.input"
            :aria-invalid="slugInvalid"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            :maxlength="limits.maxBrandSlugLength"
            :disabled="isSaving"
            autocomplete="off"
            :aria-describedby="slugDescription"
            @input="markSlugManuallyEdited"
          >
          <small :id="slugHintId" :class="$style.fieldHint">Lowercase letters, numbers, and single hyphens. Changing it breaks old links.</small>
          <p v-if="slugInvalid" :id="formErrorId" :class="$style.error" role="alert">{{ formError }}</p>
        </div>

        <p v-if="hasGeneralFormError" ref="formAlert" :class="$style.error" role="alert" tabindex="-1">{{ formError }}</p>

        <div :class="$style.dialogActions">
          <PerdButton variant="secondary" :disabled="isSaving" @click="closeBrandForm">
            Cancel
          </PerdButton>
          <PerdButton type="submit" :loading="isSaving">{{ saveLabel }}</PerdButton>
        </div>
      </form>
    </ModalDialog>

    <ConfirmationDialog
      v-model="isDeleteOpen"
      header-text="Delete brand?"
      confirm-button-text="Delete brand"
      confirm-variant="danger"
      :confirm-loading="isDeleting"
      :close-on-confirm="false"
      :error="deleteError"
      @confirm="deleteBrand"
    >
      Delete {{ deleteTarget?.name }}? This is only possible if no gear uses this brand.
    </ConfirmationDialog>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useHead, useRequestFetch } from '#imports'
  import { limits } from '#shared/constants'
  import type { BrandsListResponse } from '#server/api/equipment/brands/index.get'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import { getFetchErrorResponse } from '~/utils/fetch-error'
  import { appLocations } from '~/utils/navigation'

  type Brand = BrandsListResponse[number]

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  useHead({ title: 'Manage brands' })

  const requestFetch = useRequestFetch()
  const formHeadingId = useId()
  const nameInputId = useId()
  const slugInputId = useId()
  const slugHintId = useId()
  const formErrorId = useId()
  const slugErrorDescription = `${slugHintId} ${formErrorId}`
  const searchInput = useTemplateRef('searchInput')
  const createButton = useTemplateRef('createButton')
  const nameInput = useTemplateRef('nameInput')
  const slugInput = useTemplateRef('slugInput')
  const formAlert = useTemplateRef('formAlert')
  const search = ref('')
  const announcement = ref('')
  const rows = ref<Brand[]>([])
  const isFormOpen = ref(false)
  const editingId = ref<number | null>(null)
  const formName = ref('')
  const formSlug = ref('')
  const slugManuallyEdited = ref(false)
  const isSaving = ref(false)
  const formError = ref<string | null>(null)
  const formErrorField = ref<'name' | 'slug' | null>(null)
  const isDeleteOpen = ref(false)
  const deleteTarget = ref<Brand | null>(null)
  const isDeleting = ref(false)
  const deleteError = ref<string | null>(null)

  const { data, error: loadError, refresh, status } = await useFetch('/api/equipment/brands', {
    lazy: true
  })

  const isLoading = computed(() => status.value === 'pending')
  const hasLoadError = computed(() => Boolean(loadError.value))
  const isEmpty = computed(() => rows.value.length === 0)

  const normalizedSearch = computed(() => {
    const trimmedSearch = search.value.trim()

    return trimmedSearch.toLocaleLowerCase()
  })

  const visibleBrands = computed(() => {
    const matchingBrands = rows.value.filter((brand) => {
      const normalizedName = brand.name.toLocaleLowerCase()

      return normalizedName.includes(normalizedSearch.value)
    })

    const sortedBrands = matchingBrands.toSorted((left, right) => left.name.localeCompare(right.name))

    return sortedBrands.map((brand) => {
      const editLabel = `Edit ${brand.name}`
      const deleteLabel = `Delete ${brand.name}`

      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        editLabel,
        deleteLabel
      }
    })
  })

  const hasNoMatches = computed(() => visibleBrands.value.length === 0)
  const formHeading = computed(() => editingId.value === null ? 'Add brand' : 'Edit brand')
  const saveLabel = computed(() => editingId.value === null ? 'Create brand' : 'Save brand')
  const nameInvalid = computed(() => formErrorField.value === 'name' || undefined)
  const slugInvalid = computed(() => formErrorField.value === 'slug' || undefined)
  const nameDescription = computed(() => nameInvalid.value ? formErrorId : undefined)
  const slugDescription = computed(() => slugInvalid.value ? slugErrorDescription : slugHintId)
  const hasGeneralFormError = computed(() => formError.value !== null && formErrorField.value === null)

  function suggestSlug(name: string): string {
    const expansions = new Map([
      ['æ', 'ae'],
      ['œ', 'oe'],
      ['ß', 'ss'],
      ['ø', 'o'],
      ['ł', 'l'],
      ['đ', 'd'],
      ['ð', 'd'],
      ['þ', 'th']
    ])

    const expanded = name.replaceAll(/[æœßøłđðþ]/giu, (character) => {
      const lowercaseCharacter = character.toLowerCase()
      const expansion = expansions.get(lowercaseCharacter)

      return expansion ?? character
    })

    const normalized = expanded.normalize('NFKD')
    const withoutMarks = normalized.replaceAll(/\p{M}/gu, '')
    const lowercase = withoutMarks.toLowerCase()
    const separated = lowercase.replaceAll(/[^a-z0-9]+/gu, '-')
    const trimmed = separated.replaceAll(/^-|-$/gu, '')
    const truncated = trimmed.slice(0, limits.maxBrandSlugLength)

    return truncated.replaceAll(/-$/gu, '')
  }

  function resetFormErrors(field?: 'name' | 'slug') {
    if (field !== undefined && formErrorField.value !== null && formErrorField.value !== field) {
      return
    }

    formError.value = null
    formErrorField.value = null
  }

  watch(data, (brands) => {
    if (brands !== null && brands !== undefined) {
      rows.value = brands
    }
  }, { immediate: true })

  watch(formName, (name) => {
    if (editingId.value === null && !slugManuallyEdited.value) {
      const suggestedSlug = suggestSlug(name)

      if (suggestedSlug !== formSlug.value) {
        formSlug.value = suggestedSlug

        resetFormErrors('slug')
      }
    }
  })

  function markSlugManuallyEdited() {
    slugManuallyEdited.value = true

    resetFormErrors('slug')
  }

  function closeBrandForm() {
    isFormOpen.value = false
  }

  function openCreate() {
    editingId.value = null
    formName.value = ''
    formSlug.value = ''
    slugManuallyEdited.value = false

    resetFormErrors()

    isFormOpen.value = true
  }

  function openEdit(brand: Brand) {
    editingId.value = brand.id
    formName.value = brand.name
    formSlug.value = brand.slug
    slugManuallyEdited.value = true

    resetFormErrors()

    isFormOpen.value = true
  }

  function openDelete(brand: Brand) {
    deleteTarget.value = brand
    deleteError.value = null
    isDeleteOpen.value = true
  }

  async function retryLoad() {
    searchInput.value?.focus()
    await refresh()
  }

  async function focusFormError() {
    await nextTick()

    if (formErrorField.value === 'name') {
      nameInput.value?.focus()
    } else if (formErrorField.value === 'slug') {
      slugInput.value?.focus()
    } else {
      formAlert.value?.focus()
    }
  }

  async function focusAfterRemoval() {
    await nextTick()
    globalThis.requestAnimationFrame(() => searchInput.value?.focus())
  }

  async function saveBrand() {
    if (isSaving.value) {
      return
    }

    const name = formName.value.trim()
    const slug = formSlug.value.trim()
    const id = editingId.value
    const isSlugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)

    resetFormErrors()

    if (name === '') {
      formError.value = 'Enter a name.'
      formErrorField.value = 'name'

      await focusFormError()

      return
    }

    if (!isSlugValid) {
      formError.value = 'Enter a valid slug.'
      formErrorField.value = 'slug'

      await focusFormError()

      return
    }

    isSaving.value = true

    try {
      const body = {
        name,
        slug
      }

      const path = id === null ? '/api/equipment/brands' : `/api/equipment/brands/${id}` as const
      const method = id === null ? 'POST' : 'PATCH'

      const brand = await requestFetch(path, {
        method,
        body
      })

      const nextRows = id === null
        ? [...rows.value, brand]
        : rows.value.map((row) => row.id === brand.id ? brand : row)

      const resultAnnouncement = id === null ? `${brand.name} created.` : `${brand.name} updated.`
      const normalizedName = brand.name.toLocaleLowerCase()
      const matchesSearch = normalizedName.includes(normalizedSearch.value)

      rows.value = nextRows
      announcement.value = resultAnnouncement
      isFormOpen.value = false

      if (id === null) {
        await nextTick()
        globalThis.requestAnimationFrame(() => createButton.value?.focus())
      } else if (!matchesSearch) {
        await focusAfterRemoval()
      }
    } catch (error) {
      const response = getFetchErrorResponse(error)

      if (response.status === 409 && response.statusMessage) {
        formError.value = response.statusMessage

        if (response.statusMessage === 'Brand name already exists') {
          formErrorField.value = 'name'
        } else if (response.statusMessage === 'Brand slug already exists') {
          formErrorField.value = 'slug'
        }
      } else if (response.status === 404) {
        formError.value = 'This brand no longer exists. Reload the list.'
      } else {
        formError.value = 'Could not save the brand. Try again.'
      }
    } finally {
      isSaving.value = false
    }

    if (formError.value !== null) {
      await focusFormError()
    }
  }

  async function deleteBrand() {
    const target = deleteTarget.value

    if (target === null || isDeleting.value) {
      return
    }

    isDeleting.value = true
    deleteError.value = null

    try {
      const path = `/api/equipment/brands/${target.id}` as const

      await requestFetch(path, { method: 'DELETE' })

      const remainingRows = rows.value.filter((brand) => brand.id !== target.id)
      const resultAnnouncement = `${target.name} deleted.`

      rows.value = remainingRows
      announcement.value = resultAnnouncement
      isDeleteOpen.value = false

      await focusAfterRemoval()
    } catch (error) {
      const response = getFetchErrorResponse(error)

      if (response.status === 409) {
        deleteError.value = 'This brand is used by gear and cannot be deleted.'
      } else if (response.status === 404) {
        deleteError.value = 'This brand no longer exists. Reload the list.'
      } else {
        deleteError.value = 'Could not delete the brand. Try again.'
      }
    } finally {
      isDeleting.value = false
    }
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-20);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--spacing-16);
  }

  .searchField,
  .field {
    display: grid;
    gap: var(--spacing-8);
    min-inline-size: min(100%, 16rem);
  }

  .searchField {
    flex: 1;
  }

  .input {
    inline-size: 100%;
    min-block-size: var(--layout-button-height-medium);
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-text-tertiary);
    border-radius: var(--layout-button-radius-small);
    background: var(--color-background-elevated);
    color: var(--color-text-primary);

    &[aria-invalid='true'],
    &:user-invalid {
      border-color: var(--color-danger-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }
  }

  .announcement {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .list {
    display: grid;
    gap: var(--spacing-12);
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-16);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
  }

  .brand {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .name,
  .slug {
    overflow-wrap: anywhere;
  }

  .slug {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
  }

  .rowActions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);
  }

  .dialog {
    inline-size: min(100dvw - var(--spacing-32), 30rem);
    max-inline-size: none;
  }

  .dialogContent {
    display: grid;
    gap: var(--spacing-20);
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-24);
    background: var(--color-surface-primary);
  }

  .fieldHint {
    color: var(--color-text-secondary);
  }

  .error {
    color: var(--color-danger-primary);
  }

  .dialogActions {
    display: flex;
    justify-content: end;
    flex-wrap: wrap;
    gap: var(--spacing-8);
  }
</style>
