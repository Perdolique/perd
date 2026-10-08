<template>
  <PageContent page-title="Manage categories">
    <template #actions>
      <PerdLink :to="appLocations.admin">Back to Admin</PerdLink>
    </template>

    <main :class="$style.component">
      <div :class="$style.toolbar">
        <label :class="$style.searchField">
          <span>Search categories</span>
          <input
            ref="searchInput"
            v-model="search"
            type="search"
            autocomplete="off"
            placeholder="Search by name"
            :class="$style.input"
          >
        </label>

        <PerdButton ref="createButton" :disabled="isCreateDisabled" @click="openCreate">Add category</PerdButton>
      </div>

      <p :class="$style.announcement" role="status" aria-live="polite" aria-atomic="true">
        {{ announcement }}
      </p>

      <PageLoadingState v-if="isLoading" title="Loading categories" />

      <PagePlaceholder v-else-if="hasLoadError" emoji="🧰" title="Categories unavailable.">
        The category list could not be loaded.
        <template #actions>
          <PerdButton variant="secondary" @click="retryLoad">Retry</PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🏷️" title="No categories yet.">
        Add the first category to make it available in gear submissions.
      </PagePlaceholder>

      <PagePlaceholder v-else-if="hasNoMatches" emoji="🔎" title="No matching categories.">
        Try a different name.
      </PagePlaceholder>

      <ul v-else :class="$style.list">
        <li v-for="category in visibleCategories" :key="category.id" :class="$style.row">
          <div :class="$style.category">
            <strong :class="$style.name">{{ category.name }}</strong>
            <span :class="$style.slug">{{ category.slug }}</span>
          </div>

          <CategoryActions :category-name="category.name" :properties-location="category.propertiesLocation" @edit="openEdit(category)" @delete="openDelete(category)" />
        </li>
      </ul>
    </main>

    <ModalDialog
      v-model="isFormOpen"
      :class="$style.dialog"
      :aria-labelledby="formHeadingId"
      :close-disabled="isSaving"
    >
      <form :class="$style.dialogContent" @submit.prevent="saveCategory">
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
            :maxlength="limits.maxEquipmentCategoryNameLength"
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
            :maxlength="limits.maxEquipmentCategorySlugLength"
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
          <PerdButton variant="secondary" :disabled="isSaving" @click="closeCategoryForm">
            Cancel
          </PerdButton>
          <PerdButton type="submit" :loading="isSaving">{{ saveLabel }}</PerdButton>
        </div>
      </form>
    </ModalDialog>

    <ConfirmationDialog
      v-model="isDeleteOpen"
      header-text="Delete category?"
      confirm-button-text="Delete category"
      confirm-variant="danger"
      :confirm-loading="isDeleting"
      :close-on-confirm="false"
      :error="deleteError"
      @confirm="deleteCategory"
    >
      Delete {{ deleteTarget?.name }}? Its properties and their options will also be deleted. This is only possible if no gear uses this category, including pending and rejected submissions.
    </ConfirmationDialog>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useHead, useRequestFetch } from '#imports'
  import { limits } from '#shared/constants'
  import type { CategoriesListResponse } from '#server/api/equipment/categories/index.get'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import CategoryActions from '~/components/equipment/categories/CategoryActions.vue'
  import { getFetchErrorResponse } from '~/utils/fetch-error'
  import { appLocations, createAdminCategoryPropertiesLocation } from '~/utils/navigation'

  type Category = CategoriesListResponse[number]

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  useHead({ title: 'Manage categories' })

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
  const rows = ref<Category[]>([])
  const isFormOpen = ref(false)
  const editingId = ref<number | null>(null)
  const formName = ref('')
  const formSlug = ref('')
  const slugManuallyEdited = ref(false)
  const isSaving = ref(false)
  const formError = ref<string | null>(null)
  const formErrorField = ref<'name' | 'slug' | null>(null)
  const isDeleteOpen = ref(false)
  const deleteTarget = ref<Category | null>(null)
  const isDeleting = ref(false)
  const deleteError = ref<string | null>(null)

  const { data, error: loadError, refresh, status } = await useFetch('/api/equipment/categories', {
    lazy: true
  })

  const isLoading = computed(() => status.value === 'pending')
  const hasLoadError = computed(() => Boolean(loadError.value))
  const isCreateDisabled = computed(() => isLoading.value || hasLoadError.value)
  const isEmpty = computed(() => rows.value.length === 0)

  const normalizedSearch = computed(() => {
    const trimmedSearch = search.value.trim()

    return trimmedSearch.toLocaleLowerCase()
  })

  const visibleCategories = computed(() => {
    const matchingCategories = rows.value.filter((category) => {
      const normalizedName = category.name.toLocaleLowerCase()

      return normalizedName.includes(normalizedSearch.value)
    })

    const sortedCategories = matchingCategories.toSorted((left, right) => left.name.localeCompare(right.name))

    return sortedCategories.map((category) => {
      return {
        propertiesLocation: createAdminCategoryPropertiesLocation(category.id),
        id: category.id,
        name: category.name,
        slug: category.slug
      }
    })
  })

  const hasNoMatches = computed(() => visibleCategories.value.length === 0)
  const formHeading = computed(() => editingId.value === null ? 'Add category' : 'Edit category')
  const saveLabel = computed(() => editingId.value === null ? 'Create category' : 'Save category')
  const nameInvalid = computed(() => formErrorField.value === 'name' || undefined)
  const slugInvalid = computed(() => formErrorField.value === 'slug' || undefined)
  const nameDescription = computed(() => nameInvalid.value ? formErrorId : undefined)
  const slugDescription = computed(() => slugInvalid.value ? slugErrorDescription : slugHintId)
  const hasGeneralFormError = computed(() => formError.value !== null && formErrorField.value === null)

  const listStateAnnouncement = computed(() => {
    if (isLoading.value) {
      return 'Loading categories.'
    }

    if (hasLoadError.value) {
      return 'The category list could not be loaded.'
    }

    if (isEmpty.value) {
      return 'No categories yet.'
    }

    return hasNoMatches.value ? 'No matching categories.' : ''
  })

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
    const truncated = trimmed.slice(0, limits.maxEquipmentCategorySlugLength)

    return truncated.replaceAll(/-$/gu, '')
  }

  function resetFormErrors(field?: 'name' | 'slug') {
    if (field !== undefined && formErrorField.value !== null && formErrorField.value !== field) {
      return
    }

    formError.value = null
    formErrorField.value = null
  }

  watch(data, (categories) => {
    if (categories !== null && categories !== undefined) {
      rows.value = categories
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

  // List requests and searches announce state changes; writes keep their own result message.
  watch([status, normalizedSearch], () => {
    announcement.value = listStateAnnouncement.value
  })

  function markSlugManuallyEdited() {
    slugManuallyEdited.value = true

    resetFormErrors('slug')
  }

  function closeCategoryForm() {
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

  function openEdit(category: Category) {
    editingId.value = category.id
    formName.value = category.name
    formSlug.value = category.slug
    slugManuallyEdited.value = true

    resetFormErrors()

    isFormOpen.value = true
  }

  function openDelete(category: Category) {
    deleteTarget.value = category
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

  async function saveCategory() {
    if (isSaving.value) {
      return
    }

    const name = formName.value.trim()
    const slug = formSlug.value.trim()
    const id = editingId.value

    resetFormErrors()

    if (name === '') {
      formError.value = 'Enter a name.'
      formErrorField.value = 'name'

      await focusFormError()

      return
    }

    isSaving.value = true

    try {
      const body = {
        name,
        slug
      }

      const path = id === null ? '/api/equipment/categories' : `/api/equipment/categories/${id}` as const
      const method = id === null ? 'POST' : 'PATCH'

      const category = await requestFetch(path, {
        method,
        body
      })

      const nextRows = id === null
        ? [...rows.value, category]
        : rows.value.map((row) => row.id === category.id ? category : row)

      const resultAnnouncement = id === null ? `${category.name} created.` : `${category.name} updated.`
      const normalizedName = category.name.toLocaleLowerCase()
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

        if (response.statusMessage === 'Category slug already exists') {
          formErrorField.value = 'slug'
        }
      } else if (response.status === 404) {
        formError.value = 'This category no longer exists. Reload the list.'
      } else {
        formError.value = 'Could not save the category. Try again.'
      }
    } finally {
      isSaving.value = false
    }

    if (formError.value !== null) {
      await focusFormError()
    }
  }

  async function deleteCategory() {
    const target = deleteTarget.value

    if (target === null || isDeleting.value) {
      return
    }

    isDeleting.value = true
    deleteError.value = null

    try {
      const path = `/api/equipment/categories/${target.id}` as const

      await requestFetch(path, { method: 'DELETE' })

      const remainingRows = rows.value.filter((category) => category.id !== target.id)
      const resultAnnouncement = `${target.name} deleted.`

      rows.value = remainingRows
      announcement.value = resultAnnouncement
      isDeleteOpen.value = false

      await focusAfterRemoval()
    } catch (error) {
      const response = getFetchErrorResponse(error)

      if (response.status === 409) {
        deleteError.value = 'This category is used by gear and cannot be deleted.'
      } else if (response.status === 404) {
        deleteError.value = 'This category no longer exists. Reload the list.'
      } else {
        deleteError.value = 'Could not delete the category. Try again.'
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
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-16);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
  }

  .category {
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
