<template>
  <PageContent :page-title="navigationLabels.myGear">
    <template #actions>
      <PerdButton
        ref="addButton"
        :disabled="isAddDisabled"
        aria-haspopup="dialog"
        @click="openCreate"
      >Add custom gear</PerdButton>
      <PerdLink :to="appRoutes.gearLibrary">
        Find gear
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading my gear"
      />

      <PagePlaceholder v-else-if="hasError" emoji="🎒" title="My gear unavailable.">
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🧺" title="No saved gear yet." />

      <div v-else :class="$style.list">
        <PageSummaryHeader :label="navigationLabels.myGear" :value="myGearSummaryText" />

        <p v-if="removeErrorMessage" :class="$style.errorMessage" role="status">
          {{ removeErrorMessage }}
        </p>

        <MyGearItemCard
          v-for="myGearRow in myGearItems"
          :key="myGearRow.id"
          ref="cards"
          :my-gear-row="myGearRow"
          @remove="requestRemove"
          @rename="openRename"
        />
      </div>
    </div>

    <CustomGearDialog
      v-model="isEditOpen"
      :initial-name="initialName"
      :renaming="isRenaming"
      :loading="isSaving"
      :error="saveError"
      @save="handleSave"
    />

    <ConfirmationDialog
      ref="removeDialog"
      v-model="isRemoveOpen"
      header-text="Remove custom gear"
      confirm-button-text="Remove gear"
      confirm-variant="danger"
      :close-on-confirm="false"
      :confirm-loading="isRemoving"
      :confirm-disabled="isRemoving"
      :error="removeDialogError"
      @confirm="confirmRemove"
    >Remove “{{ removalName }}” from My gear?</ConfirmationDialog>

    <p :class="$style.announcement" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch } from '#imports'
  import { useGearLibraryStore } from '~/stores/gear-library'
  import { appRoutes, navigationLabels } from '~/utils/navigation'
  import type { MyGearRecordView } from '~/types/equipment'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PageSummaryHeader from '~/components/PageSummaryHeader.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import MyGearItemCard from '~/components/my-gear/MyGearItemCard.vue'
  import CustomGearDialog from '~/components/my-gear/CustomGearDialog.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({ layout: 'page' })

  const removeErrorMessage = ref<string | null>(null)
  const removeDialogError = ref<string | null>(null)
  const saveError = ref<string | null>(null)
  const removingMyGearId = ref<string | null>(null)
  const editingId = ref<string | null>(null)
  const removalId = ref<string | null>(null)
  const initialName = ref('')
  const removalName = ref('')
  const announcement = ref('')
  const isEditOpen = ref(false)
  const isRemoveOpen = ref(false)
  const isSaving = ref(false)
  const cards = useTemplateRef('cards')
  const addButton = useTemplateRef('addButton')
  const removeDialog = useTemplateRef('removeDialog')
  const myGearDateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })
  const requestFetch = useRequestFetch()
  const gearLibraryStore = useGearLibraryStore()
  let isActive = true

  const {
    data: myGearResponse,
    error: myGearError,
    refresh: refreshMyGear,
    status: myGearStatus
  } = await useFetch('/api/user/gear', { default: () => [] })

  const hasError = computed(() => myGearError.value !== undefined)
  const isInitialLoading = computed(() => myGearStatus.value === 'pending')
  const isEmpty = computed(() => myGearResponse.value.length === 0)
  const isRemoving = computed(() => removingMyGearId.value !== null)
  const isBusy = computed(() => isSaving.value || isRemoving.value)
  const isAddDisabled = computed(() => myGearStatus.value !== 'success' || isBusy.value)
  const isRenaming = computed(() => editingId.value !== null)

  const myGearSummaryText = computed(() => {
    const itemCount = myGearResponse.value.length

    return `${itemCount} saved item${itemCount === 1 ? '' : 's'}`
  })

  const myGearItems = computed<MyGearRecordView[]>(() => myGearResponse.value.map((row) => {
    const date = new Date(row.createdAt)
    const formattedCreatedAt = myGearDateFormatter.format(date)
    const isRemovingRow = removingMyGearId.value === row.id

    if (row.source === 'custom') {
      return {
        id: row.id,
        createdAt: row.createdAt,
        source: 'custom',
        customName: row.customName,
        formattedCreatedAt,
        isRemoveDisabled: isBusy.value,
        isRemoving: isRemovingRow
      }
    }

    return {
      id: row.id,
      createdAt: row.createdAt,
      source: 'catalog',
      item: row.item,
      formattedCreatedAt,
      isRemoveDisabled: isBusy.value,
      isRemoving: isRemovingRow
    }
  }))

  onBeforeUnmount(() => {
    isActive = false
  })

  async function handleRetry() {
    await refreshMyGear()
  }

  function openCreate() {
    if (isAddDisabled.value) {
      return
    }

    editingId.value = null
    initialName.value = ''
    saveError.value = null
    announcement.value = ''
    isEditOpen.value = true
  }

  function openRename(id: string) {
    if (isBusy.value) {
      return
    }

    const row = myGearResponse.value.find(item => item.id === id)

    if (row?.source !== 'custom') {

      return

    }

    editingId.value = id
    initialName.value = row.customName
    saveError.value = null
    announcement.value = ''
    isEditOpen.value = true
  }

  async function handleSave(customName: string) {
    if (isBusy.value) {
      return
    }

    isSaving.value = true
    saveError.value = null

    const id = editingId.value
    const gearPath = `/api/user/gear/${id}` as const

    try {
      const saved = id === null
        ? await requestFetch('/api/user/gear', {
          method: 'POST',
          body: { customName }
        })
        : await requestFetch(gearPath, {
          method: 'PATCH',
          body: { customName }
        })

      if (!isActive) {

        return

      }

      myGearResponse.value = id === null
        ? [saved, ...myGearResponse.value]
        : myGearResponse.value.map(row => row.id === id ? saved : row)

      isEditOpen.value = false
      announcement.value = id === null ? 'Custom gear added.' : 'Custom gear renamed.'
    } catch (error) {
      globalThis.console.error('Failed to save custom gear:', error)

      if (isActive) {
        saveError.value = 'Could not save your gear. Try again.'
      }
    } finally {
      isSaving.value = false
    }
  }

  async function handleRemove(id: string) {
    if (isBusy.value) {
      return
    }

    const index = myGearResponse.value.findIndex(row => row.id === id)
    const row = myGearResponse.value[index]

    if (row === undefined) {

      return

    }

    removeErrorMessage.value = null
    removeDialogError.value = null
    removingMyGearId.value = id
    announcement.value = ''

    const gearPath = `/api/user/gear/${id}` as const

    try {
      await requestFetch(gearPath, { method: 'DELETE' })

      if (row.source === 'catalog') {
        gearLibraryStore.markItemRemoved(row.item.id)
      }

      if (!isActive) {

        return

      }

      myGearResponse.value = myGearResponse.value.filter(item => item.id !== id)
      isRemoveOpen.value = false
      removingMyGearId.value = null
      announcement.value = 'Gear removed.'

      await nextTick()

      const nextRow = myGearResponse.value[index] ?? myGearResponse.value[index - 1]
      const nextCard = cards.value?.find(card => card?.id === nextRow?.id)

      if (nextCard) {
        nextCard.focus()
      } else {
        addButton.value?.focus()
      }
    } catch (error) {
      globalThis.console.error('Failed to remove gear:', error)

      if (!isActive) {

        return

      }

      if (row.source === 'custom') {
        removeDialogError.value = 'Could not remove your gear. It may still be used in a list. Try again.'
      } else {
        removeErrorMessage.value = 'Could not remove item.'
      }
    } finally {
      removingMyGearId.value = null

      await nextTick()

      if (isActive && removeDialogError.value) {
        removeDialog.value?.focusConfirm()
      } else if (isActive && removeErrorMessage.value) {
        const card = cards.value?.find(item => item?.id === id)

        card?.focus()
      }
    }
  }

  async function requestRemove(id: string) {
    if (isBusy.value) {
      return
    }

    const row = myGearResponse.value.find(item => item.id === id)

    if (row?.source === 'custom') {
      removalId.value = id
      removalName.value = row.customName
      removeDialogError.value = null
      announcement.value = ''
      isRemoveOpen.value = true

      return
    }

    await handleRemove(id)
  }

  async function confirmRemove() {
    if (removalId.value !== null) {
      await handleRemove(removalId.value)
    }
  }
</script>

<style module>
  .announcement {
    position: absolute;
    overflow: hidden;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .component {
    display: grid;
  }

  .errorMessage {
    color: var(--color-danger-primary);
  }

  .list {
    display: grid;
    gap: var(--spacing-24);
  }

</style>
