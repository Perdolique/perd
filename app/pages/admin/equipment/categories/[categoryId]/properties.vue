<template>
  <PageContent :page-title="pageTitle">
    <template #actions><PerdLink :to="appRoutes.adminEquipmentCategories">Back to categories</PerdLink></template>
    <main :class="$style.component">
      <div :class="$style.toolbar">
        <PerdButton ref="createButton" :disabled="editsDisabled" @click="openCreate">Add characteristic</PerdButton>
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
      <template v-if="snapshot">
        <div v-if="orderDirty" :class="$style.toolbar">
          <span>Order has not been saved.</span>
          <PerdButton :loading="saving" :disabled="hasConflict" @click="saveOrder">Save order</PerdButton>
          <PerdButton variant="secondary" :disabled="saving" @click="cancelOrder">Cancel</PerdButton>
        </div>
        <ul ref="propertyList" :class="$style.list" :aria-busy="saving">
          <PropertyListRow v-for="(property, index) in orderedProperties" :key="property.id" :property="property" :index="index" :total="orderedProperties.length" :busy="busy" :edits-disabled="editsDisabled" @move="moveProperty" @edit="openEdit" @delete="prepareDelete" @edit-option="openOption" @delete-option="prepareOptionDelete" @drag-start="startDrag" @drag-move="dragMove" @drag-end="endDrag" @drag-cancel="cancelDrag" />
        </ul>
      </template>
    </main>
    <ConfirmationDialog v-model="leaveOpen" header-text="Discard order changes" confirm-button-text="Discard" @confirm="confirmLeave">Leave this page and discard the unsaved characteristic order?</ConfirmationDialog>
    <PropertyFormDialog v-model="formOpen" :category-id="categoryId" :property="editingProperty" :revision="revision" @saved="acceptSnapshot" @conflict="handleConflict" />
    <EnumOptionFormDialog v-model="optionFormOpen" :category-id="categoryId" :property-id="optionPropertyId" :option="editingOption" :revision="revision" @saved="acceptSnapshot" @conflict="handleConflict" />
    <ConfirmationDialog v-model="deleteOpen" header-text="Delete characteristic" confirm-button-text="Delete characteristic" confirm-variant="danger" :confirm-loading="saving" :confirm-disabled="deleteDisabled" :close-on-confirm="false" :error="deleteError" @confirm="deleteProperty">
      <template v-if="deletingProperty"><p>Delete {{ deletingProperty.name }}?</p><p>This removes values from {{ deletingProperty.usedItemCount }} items and deletes {{ deletingProperty.enumOptions.length }} enum options. The items, photos, My gear, and packing lists stay.</p></template>
    </ConfirmationDialog>
    <ConfirmationDialog v-model="optionDeleteOpen" header-text="Delete option" confirm-button-text="Delete option" confirm-variant="danger" :confirm-loading="saving" :close-on-confirm="false" :error="deleteError" @confirm="deleteOption">Delete {{ deletingOption?.name }}? This option is not used by any items.</ConfirmationDialog>
  </PageContent>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useHead, useRequestFetch, useRoute } from '#imports'

  import type {
    AdminCategoryProperty,
    AdminCategoryPropertiesSnapshot,
    AdminPropertyOption
  } from '#server/utils/equipment/category-properties'

  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PropertyFormDialog from '~/components/equipment/category-properties/PropertyFormDialog.vue'
  import EnumOptionFormDialog from '~/components/equipment/category-properties/EnumOptionFormDialog.vue'
  import PropertyListRow from '~/components/equipment/category-properties/PropertyListRow.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { useCategoryPropertyOrder } from '~/composables/use-category-property-order'
  import { appRoutes } from '~/utils/navigation'
  import { getFetchErrorResponse } from '~/utils/fetch-error'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const route = useRoute()
  const categoryId = Number(route.params.categoryId)
  const path = `/api/equipment/categories/${categoryId}/properties` as const
  const requestFetch = useRequestFetch()
  const { data, error: loadRequestError, status, refresh } = await useFetch(path)
  const snapshot = ref<AdminCategoryPropertiesSnapshot | null>(data.value ?? null)
  const createButton = useTemplateRef('createButton')
  const retryButton = useTemplateRef('retryButton')
  const saving = ref(false)
  const formOpen = ref(false)
  const optionFormOpen = ref(false)
  const editingProperty = ref<AdminCategoryProperty | null>(null)
  const editingOption = ref<AdminPropertyOption | null>(null)
  const optionPropertyId = ref(0)
  const deletingProperty = ref<AdminCategoryProperty | null>(null)
  const deletingOption = ref<AdminPropertyOption | null>(null)
  const deleteRevision = ref(0)
  const deleteOpen = ref(false)
  const optionDeleteOpen = ref(false)
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
  const { orderDirty, orderedProperties, announcement, cancelOrder, moveProperty, startDrag, dragMove, endDrag, cancelDrag, draftIds, leaveOpen, confirmLeave } = useCategoryPropertyOrder(properties, busy)
  const editsDisabled = computed(() => busy.value || orderDirty.value || hasConflict.value || snapshot.value === null)
  const reloadDisabled = computed(() => busy.value || orderDirty.value)
  const deleteDisabled = computed(() => saving.value || deletingProperty.value === null)
  const recoveryMessage = computed(() => orderDirty.value ? 'The list changed. Cancel your order draft before reloading.' : 'The list changed or this edit is no longer allowed. Reload before making more changes.')

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
    editingProperty.value = null
    formOpen.value = true
  }
  function openEdit(property: AdminCategoryProperty) {
    editingProperty.value = property
    formOpen.value = true
  }
  function openOption(propertyId: number, option: AdminPropertyOption | null) {
    optionPropertyId.value = propertyId
    editingOption.value = option
    optionFormOpen.value = true
  }
  async function prepareDelete(property: AdminCategoryProperty) {
    if (editsDisabled.value) {
      return
    }

    saving.value = true
    actionError.value = ''

    try {
      const fresh = await requestFetch(path)

      acceptSnapshot(fresh)

      deletingProperty.value = fresh.properties.find((entry) => entry.id === property.id) ?? null
      deleteRevision.value = fresh.category.propertiesRevision
      deleteError.value = null
      deleteOpen.value = deletingProperty.value !== null
    } catch {
      actionError.value = 'Could not load the current deletion details. Try again.'
    } finally {
      saving.value = false
    }
  }
  function prepareOptionDelete(propertyId: number, option: AdminPropertyOption) {
    optionPropertyId.value = propertyId
    deletingOption.value = option
    deleteRevision.value = revision.value
    deleteError.value = null
    optionDeleteOpen.value = true
  }
  async function deleteProperty() {
    const property = deletingProperty.value

    if (saving.value || property === null) {
      return
    }

    saving.value = true
    deleteError.value = null

    try {
      const result = await requestFetch(`${path}/${property.id}`, {
        method: 'DELETE',

        body: {
          expectedPropertiesRevision: deleteRevision.value,
          expectedAffectedItemCount: property.usedItemCount
        }
      })

      acceptSnapshot(result)

      deleteOpen.value = false

      await nextTick()
      globalThis.requestAnimationFrame(() => createButton.value?.focus())
    } catch (error) {
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
        } catch {
          deleteError.value = 'Could not refresh the deletion details. Cancel and try again.'
        }
      }
    } finally {
      saving.value = false
    }
  }
  async function deleteOption() {
    const option = deletingOption.value

    if (saving.value || option === null) {
      return
    }

    saving.value = true
    deleteError.value = null

    try {
      const result = await requestFetch(`${path}/${optionPropertyId.value}/enum-options/${option.id}`, {
        method: 'DELETE',
        body: { expectedPropertiesRevision: deleteRevision.value }
      })

      acceptSnapshot(result)

      optionDeleteOpen.value = false

      await nextTick()

      globalThis.requestAnimationFrame(() => {
        globalThis.document.querySelector<HTMLElement>(`[data-property-id="${optionPropertyId.value}"]`)?.focus()
      })
    } catch (error) {
      const { status: statusCode } = getFetchErrorResponse(error)

      if (statusCode === 409) {
        handleConflict()

        deleteError.value = 'This option may now be in use or the list changed. Cancel and reload the list.'
      } else {
        deleteError.value = 'Could not delete this option. Try again.'
      }
    } finally {
      saving.value = false
    }
  }
  async function saveOrder() {
    if (saving.value || !orderDirty.value) {
      return
    }

    saving.value = true
    actionError.value = ''

    try {
      const result = await requestFetch(`${path}/order`, {
        method: 'PATCH',

        body: {
          expectedPropertiesRevision: revision.value,
          propertyIds: draftIds.value
        }
      })

      acceptSnapshot(result)
      await cancelOrder()

      announcement.value = 'Order saved.'
    } catch (error) {
      const { status: statusCode } = getFetchErrorResponse(error)

      if (statusCode === 409) {
        handleConflict()

        actionError.value = 'The list changed. Your draft is still here. Cancel it and reload before trying again.'
      } else {
        actionError.value = 'Could not save the order. Your draft is still here. Try again.'
      }
    } finally {
      saving.value = false
    }
  }
</script>

<style module>
  .component { display: grid; gap: var(--spacing-16); }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-12); }
  .recovery { display: grid; justify-items: start; gap: var(--spacing-12); }
  .list { display: grid; gap: var(--spacing-12); list-style: none; }
  .announcement { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
  .error { color: var(--color-danger-primary); }
</style>
