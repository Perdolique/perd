<template>
  <PageContent page-title="Edit item">
    <template #actions><PerdLink :to="itemLocation">Back to item</PerdLink></template>
    <PageLoadingState v-if="isInitialLoading" title="Loading item" />
    <PagePlaceholder v-else-if="!snapshot" emoji="🧰" title="Item unavailable">
      {{ loadErrorMessage }}
      <template #actions><PerdButton variant="secondary" @click="reloadItem">Retry</PerdButton></template>
    </PagePlaceholder>
    <EquipmentItemEditor
      v-else-if="editorValue"
      :key="editorKey"
      :autofocus="shouldAutofocusEditor"
      :initial-value="editorValue"
      :initial-category="snapshot.category"
      :is-submitting="isBusy"
      :properties-conflict="hasConflict"
      :conflict-message="conflictMessage"
      :mutation-message="mutationMessage"
      mode="edit"
      @submit="save"
      @cancel="cancel"
      @reload="reloadItem"
      @dirty="setDirty"
    />
    <ConfirmationDialog v-model="leaveOpen" header-text="Discard changes" confirm-button-text="Discard" @confirm="confirmLeave">
      Leave this page and discard your unsaved item changes?
    </ConfirmationDialog>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
  import { useEventListener } from '@vueuse/core'
  import { onBeforeRouteLeave } from 'vue-router'
  import { definePageMeta, navigateTo, useFetch, useRequestFetch, useRoute } from '#imports'
  import EquipmentItemEditor, { type EquipmentItemEditorValue } from '~/components/equipment/EquipmentItemEditor.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import { useGearLibraryStore } from '~/stores/gear-library'
  import { buildGearLibraryRouteQuery, getGearLibraryRouteState } from '~/utils/gear-library'

  import {
    getCategoryPropertiesErrorCode,
    logUnexpectedCategoryPropertiesError
  } from '~/utils/category-properties-error'

  import { getFetchErrorResponse } from '~/utils/fetch-error'
  import { createGearLibraryItemLocation } from '~/utils/navigation'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const route = useRoute('admin-equipment-items-id-edit')
  const requestFetch = useRequestFetch()
  const store = useGearLibraryStore()
  const itemId = route.params.id
  const editPath = `/api/equipment/items/${itemId}/edit` as const
  const itemPath = `/api/equipment/items/${itemId}` as const
  const { data, error: loadError, status, refresh } = await useFetch(editPath)
  const snapshot = shallowRef(data.value)
  const isSaving = ref(false)
  const isReloading = ref(false)
  const isBusy = computed(() => isSaving.value || isReloading.value)
  const isDirty = ref(false)
  const isSaved = ref(false)
  const hasConflict = ref(false)
  const conflictMessage = ref<string>()
  const mutationMessage = ref<string | null>(null)
  const editorKey = ref(0)
  const shouldAutofocusEditor = computed(() => editorKey.value > 0)
  const leaveOpen = ref(false)
  let resolveLeave: ((value: boolean) => void) | null = null
  const isInitialLoading = computed(() => status.value === 'pending' && !snapshot.value)

  const loadErrorMessage = computed(() => {
    const response = getFetchErrorResponse(loadError.value)

    return response.status === 404 ? 'This item may not be published or may no longer exist.' : 'Could not load the item. Try again.'
  })

  const itemLocation = computed(() => {
    const state = getGearLibraryRouteState(route.query)
    const query = buildGearLibraryRouteQuery(state)

    return createGearLibraryItemLocation(itemId, query)
  })

  const editorValue = computed<EquipmentItemEditorValue | null>(() => {
    const item = snapshot.value

    if (!item) { return null }

    return {
      name: item.name,
      brandId: item.brand.id,
      categoryId: item.category.id,
      properties: item.properties,
      expectedOriginalPropertiesRevision: item.category.propertiesRevision
    }
  })

  function setDirty(value: boolean) { isDirty.value = value }

  async function cancel() { await navigateTo(itemLocation.value) }

  async function reloadItem() {
    if (isBusy.value) { return }

    isReloading.value = true

    await refresh()

    if (loadError.value || !data.value) {
      logUnexpectedCategoryPropertiesError('Could not reload the published item.', loadError.value)

      mutationMessage.value = 'Could not reload the item. Your draft is still here. Try again.'
    } else {
      snapshot.value = data.value
      hasConflict.value = false
      conflictMessage.value = undefined
      mutationMessage.value = null
      isDirty.value = false
      editorKey.value += 1
    }

    isReloading.value = false
  }

  async function save(value: EquipmentItemEditorValue) {
    const item = snapshot.value

    if (isBusy.value || hasConflict.value || !item || value.expectedPropertiesRevision === undefined) { return }

    isSaving.value = true
    mutationMessage.value = null

    try {
      await requestFetch(itemPath, {
        method: 'PATCH',

        body: {
          name: value.name,
          brandId: value.brandId,
          categoryId: value.categoryId,
          properties: value.properties,
          expectedItemRevision: item.revision,
          expectedOriginalPropertiesRevision: item.category.propertiesRevision,
          expectedPropertiesRevision: value.expectedPropertiesRevision,
          categoryChangeConfirmed: value.categoryChangeConfirmed
        }
      })
    } catch (error) {
      const response = getFetchErrorResponse(error)
      const code = getCategoryPropertiesErrorCode(error)

      if (response.status === 409) {
        hasConflict.value = true
        conflictMessage.value = code === 'properties_revision_conflict'
          ? 'Characteristics changed since this form was loaded. Your draft is still here. Reload before saving.'
          : 'This item or its reference data changed since it was loaded. Your draft is still here. Reload before saving.'
      } else {
        logUnexpectedCategoryPropertiesError('Could not save the published item.', error)

        mutationMessage.value = 'Could not confirm that changes were saved. Your draft is still here. Try again or reload the item.'
      }

      isSaving.value = false

      return
    }

    isSaved.value = true
    isDirty.value = false

    store.markItemEdited(itemId)

    isSaving.value = false

    await navigateTo(itemLocation.value, { replace: true })
  }

  onBeforeRouteLeave(() => {
    if (isSaving.value) { return false }

    if (!isDirty.value || isSaved.value) { return true }

    leaveOpen.value = true

    // oxlint-disable-next-line promise/avoid-new -- Navigation waits for the administrator's explicit discard decision.
    return new Promise<boolean>((resolve) => { resolveLeave = resolve })
  })

  function confirmLeave() {
    resolveLeave?.(true)

    resolveLeave = null
  }

  watch(leaveOpen, (open) => {
    if (!open) {
      resolveLeave?.(false)

      resolveLeave = null
    }
  })

  useEventListener(() => globalThis.window, 'beforeunload', (event) => {
    if (isDirty.value && !isSaved.value) { event.preventDefault() }
  })

  onScopeDispose(() => resolveLeave?.(false))
</script>
