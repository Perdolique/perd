<template>
  <PageContent :page-title="pageTitle">
    <template #actions><PerdLink :to="appLocations.adminEquipmentCategories">Back to categories</PerdLink></template>
    <main :class="$style.component">
      <div :class="$style.toolbar">
        <span :class="$style.count">{{ properties.length }} characteristics</span><div :class="$style.toolbarActions"><PerdButton ref="createButton" size="small" icon="hugeicons:add-01" :disabled="editsDisabled" @click="openCreate">Add characteristic</PerdButton><PerdButton size="small" variant="secondary" icon="hugeicons:sorting-05" :disabled="reorderDisabled" @click="openOrder">Reorder</PerdButton></div>
      </div>
      <p :class="$style.announcement" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
      <PageLoadingState v-if="initialLoading" title="Loading characteristics" />
      <div v-if="loadError" role="alert"><p>Could not load characteristics.</p><PerdButton ref="retryButton" variant="secondary" :disabled="reloadDisabled" @click="reload">Retry</PerdButton></div>
      <p v-if="actionError" :class="$style.error" role="alert">{{ actionError }}</p>
      <div v-if="hasConflict" :class="$style.recovery">
        <p>{{ recoveryMessage }}</p>
        <PerdButton v-if="showConflictReload" variant="secondary" :disabled="reloadDisabled" :loading="loading" @click="reload">Reload characteristics</PerdButton>
      </div>
      <PagePlaceholder v-if="isEmpty" emoji="🏷️" title="No characteristics yet.">Add the first characteristic for this category.</PagePlaceholder>
      <template v-if="hasProperties">
        <div :class="$style.catalog">
          <div :class="$style.listHeader" aria-hidden="true"><span>#</span><span>Characteristic</span><span>Type</span><span>Used by</span><span>Actions</span></div>
          <ul :class="$style.list" aria-label="Characteristics" :aria-busy="saving">
            <PropertyListRow v-for="(property, index) in properties" :key="property.id" :property="property" :index="index" :disabled="editsDisabled" @edit="openEdit" @delete="prepareDelete" />
          </ul>
        </div>
      </template>
    </main>
    <PropertyOrderDialog v-model="orderOpen" :category-id="categoryId" :properties="properties" :revision="revision" @saved="acceptSnapshot" @conflict="handleConflict" />
    <PropertyFormDialog v-model="formOpen" :category-id="categoryId" :property="editingProperty" :revision="revision" @saved="acceptSnapshot" @conflict="handleConflict" />
    <ConfirmationDialog v-model="deleteOpen" header-text="Delete characteristic" confirm-button-text="Delete characteristic" confirm-variant="danger" :confirm-loading="saving" :confirm-disabled="deleteDisabled" :close-on-confirm="false" :error="deleteError" @confirm="deleteProperty">
      <template v-if="deletingProperty"><p>Delete {{ deletingProperty.name }}?</p><p>This removes values from {{ deletingProperty.usedItemCount }} items and deletes {{ deletingProperty.enumOptions.length }} enum options. The items, photos, My gear, and packing lists stay.</p></template>
    </ConfirmationDialog>
  </PageContent>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useHead, useRequestFetch, useRoute } from '#imports'

  import type {
    AdminCategoryProperty,
    AdminCategoryPropertiesSnapshot
  } from '#server/utils/equipment/category-properties'

  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PropertyFormDialog from '~/components/equipment/category-properties/PropertyFormDialog.vue'
  import PropertyOrderDialog from '~/components/equipment/category-properties/PropertyOrderDialog.vue'
  import PropertyListRow from '~/components/equipment/category-properties/PropertyListRow.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appLocations } from '~/utils/navigation'
  import { logUnexpectedCategoryPropertiesError } from '~/utils/category-properties-error'
  import { getFetchErrorResponse } from '~/utils/fetch-error'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const route = useRoute('admin-equipment-categories-categoryId-properties')
  const categoryId = Number(route.params.categoryId)
  const path = `/api/equipment/categories/${categoryId}/properties` as const
  const requestFetch = useRequestFetch()
  const { data, error: loadRequestError, status, refresh } = await useFetch(path)
  const snapshot = ref<AdminCategoryPropertiesSnapshot | null>(data.value ?? null)
  const createButton = useTemplateRef('createButton')
  const retryButton = useTemplateRef('retryButton')
  const saving = ref(false)
  const formOpen = ref(false)
  const orderOpen = ref(false)
  const editingPropertyId = ref<number | null>(null)
  const editingProperty = computed(() => snapshot.value?.properties.find((property) => property.id === editingPropertyId.value) ?? null)
  const announcement = ref('')
  const deletingProperty = ref<AdminCategoryProperty | null>(null)
  const deleteRevision = ref(0)
  const deleteOpen = ref(false)
  const deleteError = ref<string | null>(null)
  const actionError = ref('')
  const hasConflict = ref(false)
  const loading = computed(() => status.value === 'pending')
  const busy = computed(() => saving.value || loading.value)
  const revision = computed(() => snapshot.value?.category.propertiesRevision ?? 0)
  const pageTitle = computed(() => snapshot.value ? `${snapshot.value.category.name} characteristics` : 'Category characteristics')
  const loadError = computed(() => loadRequestError.value !== undefined)
  const showConflictReload = computed(() => hasConflict.value && !loadError.value)
  const initialLoading = computed(() => loading.value && snapshot.value === null)
  const isEmpty = computed(() => snapshot.value !== null && snapshot.value.properties.length === 0)
  const properties = computed(() => snapshot.value?.properties ?? [])
  const hasProperties = computed(() => properties.value.length > 0)
  const editsDisabled = computed(() => busy.value || orderOpen.value || hasConflict.value || snapshot.value === null)
  const reorderDisabled = computed(() => editsDisabled.value || properties.value.length < 2)
  const reloadDisabled = computed(() => busy.value || orderOpen.value)
  const deleteDisabled = computed(() => saving.value || deletingProperty.value === null)
  const recoveryMessage = 'The list changed or this edit is no longer allowed. Reload before making more changes.'

  useHead({ title: pageTitle })

  watch(data, (value) => {
    if (value !== undefined) {
      snapshot.value = value
    }
  })

  function acceptSnapshot(value: AdminCategoryPropertiesSnapshot) {
    snapshot.value = value
    data.value = value
    actionError.value = ''
    hasConflict.value = false
    announcement.value = 'Characteristics saved.'
  }
  async function reload() {
    await refresh()

    if (status.value === 'success' && data.value !== undefined) {
      acceptSnapshot(data.value)

      announcement.value = 'Characteristics reloaded.'

      await nextTick()
      createButton.value?.focus()
    } else {
      await nextTick()
      retryButton.value?.focus()
    }
  }
  function handleConflict() {
    hasConflict.value = true
  }
  function openCreate() {
    editingPropertyId.value = null
    formOpen.value = true
  }
  function openEdit(property: AdminCategoryProperty) {
    editingPropertyId.value = property.id
    formOpen.value = true
  }
  function openOrder() {
    orderOpen.value = true
  }
  async function prepareDelete(property: AdminCategoryProperty) {
    if (editsDisabled.value) {
      return
    }

    const { activeElement } = globalThis.document
    const returnFocusElement = activeElement instanceof globalThis.HTMLElement ? activeElement : null

    saving.value = true
    deletingProperty.value = null
    actionError.value = ''

    try {
      const fresh = await requestFetch(path)

      acceptSnapshot(fresh)

      deletingProperty.value = fresh.properties.find((entry) => entry.id === property.id) ?? null
      deleteRevision.value = fresh.category.propertiesRevision
      deleteError.value = null
    } catch (error) {
      logUnexpectedCategoryPropertiesError('Failed to load characteristic deletion details:', error)

      actionError.value = 'Could not load the current deletion details. Try again.'
    } finally {
      saving.value = false
    }

    await nextTick()

    if (returnFocusElement?.isConnected) {
      returnFocusElement.focus()
    } else {
      createButton.value?.focus()
    }

    deleteOpen.value = deletingProperty.value !== null
  }
  async function deleteProperty() {
    const property = deletingProperty.value

    if (saving.value || property === null) {
      return
    }

    saving.value = true
    deleteError.value = null

    try {
      const expectedPropertiesRevision = String(deleteRevision.value)
      const expectedAffectedItemCount = String(property.usedItemCount)

      const result = await requestFetch(`${path}/${property.id}`, {
        method: 'DELETE',

        query: {
          expectedPropertiesRevision,
          expectedAffectedItemCount
        }
      })

      acceptSnapshot(result)

      deleteOpen.value = false

      await nextTick()
      globalThis.requestAnimationFrame(() => createButton.value?.focus())
    } catch (error) {
      logUnexpectedCategoryPropertiesError('Failed to delete characteristic:', error)

      const { status: statusCode } = getFetchErrorResponse(error)

      deleteError.value = 'Could not delete the characteristic. Try again.'

      if (statusCode === 409) {
        deletingProperty.value = null

        try {
          const fresh = await requestFetch(path)

          acceptSnapshot(fresh)

          deletingProperty.value = fresh.properties.find((entry) => entry.id === property.id) ?? null
          deleteRevision.value = fresh.category.propertiesRevision
          deleteError.value = deletingProperty.value === null ? 'This characteristic no longer exists.' : 'The deletion details changed. Review the new counts and confirm again.'
        } catch (refreshError) {
          logUnexpectedCategoryPropertiesError('Failed to refresh characteristic deletion details:', refreshError)

          deleteError.value = 'Could not refresh the deletion details. Cancel and try again.'
        }
      }
    } finally {
      saving.value = false
    }
  }
</script>

<style module>
  .component { display: grid; gap: var(--spacing-24); }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spacing-12); }
  .toolbarActions { display: flex; flex-wrap: wrap; gap: var(--spacing-12); }
  .count { color: var(--color-text-secondary); }
  .recovery { display: grid; justify-items: start; gap: var(--spacing-12); }
  .catalog { container-type: inline-size; border: 1px solid var(--color-border-subtle); border-radius: var(--border-radius-10); overflow: clip; }
  .listHeader { display: grid; grid-template-columns: 2rem minmax(0, 1fr) minmax(8rem, 1fr) 5rem 7.5rem; align-items: center; gap: var(--spacing-16); padding: var(--spacing-12) var(--spacing-16); background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: var(--font-size-14); border-block-end: 1px solid var(--color-border-subtle); }
  .list { list-style: none; padding: 0; }
  .announcement { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
  .error { color: var(--color-danger-primary); }
  @container (width < 42rem) { .listHeader { display: none; } }
</style>
