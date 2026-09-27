<template>
  <PageContent :class="$style.component" :page-title="pageTitle">
    <template v-if="canRenamePackingList" #actions>
      <PerdButton
        variant="secondary"
        size="small"
        icon="hugeicons:pencil-edit-02"
        aria-haspopup="dialog"
        :disabled="isRenaming"
        @click="openRenameDialog"
      >
        Rename
      </PerdButton>
    </template>

    <div :class="$style.body">
      <PageLoadingState
        v-if="isPackingListLoading"
        title="Loading packing list"
      />

      <PagePlaceholder v-else-if="hasPackingListError" emoji="🎒" title="Packing list unavailable.">
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.content">
        <p
          :class="[$style.progress, { isEmpty: isPackingListEmpty }]"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ packingProgressText }}
        </p>

        <ul :class="$style.entryList">
          <PackingListEntryCard
            v-for="entry in entryViews"
            :key="entry.id"
            :entry="entry"
            @pack-change="handlePackChange"
            @remove="handleRemoveEntry"
          />

          <PackingListEntryComposer
            ref="entryComposer"
            :packing-list-id="packingListId"
            :initially-open="isComposerInitiallyOpen"
            @created="handleEntryCreated"
          />
        </ul>

        <p
          v-if="hasEntryRemoveError"
          :class="$style.errorMessage"
          role="status"
          aria-live="polite"
        >
          {{ entryRemoveErrorMessage }}
        </p>
      </div>
    </div>

    <ConfirmationDialog
      v-model="isRenameDialogVisible"
      header-text="Rename packing list"
      confirm-button-text="Save name"
      :close-on-confirm="false"
      :confirm-disabled="isRenameDisabled"
      :confirm-loading="isRenaming"
      :error="renameErrorMessage"
      @confirm="handleRename"
    >
      <form novalidate @submit.prevent="handleRename">
        <TextInput
          ref="renameInput"
          v-model="editedName"
          name="packing-list-name"
          label="List name"
          :disabled="isRenaming"
          :error="nameErrorMessage"
          required
        />
      </form>
    </ConfirmationDialog>

    <p :class="$style.announcement" aria-live="polite" aria-atomic="true">{{ renameAnnouncement }}</p>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, reactive, ref, useTemplateRef } from 'vue'
  import * as v from 'valibot'
  import { definePageMeta, useFetch, useRoute } from '#imports'
  import { limits } from '#shared/constants'

  import type {
    PackingListDetail,
    PackingListEntry,
    PackingListEntryView,
    PackingListInventoryEntry
  } from '~/types/packing'

  import { formatPackingProgress } from '~/utils/packing'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import TextInput from '~/components/TextInput.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PackingListEntryComposer from '~/components/packing-lists/PackingListEntryComposer.vue'
  import PackingListEntryCard from '~/components/packing-lists/PackingListEntryCard.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const packingListsStore = usePackingListsStore()
  const entryComposerRef = useTemplateRef('entryComposer')
  const entryRemoveErrorMessage = ref<string | null>(null)
  const lastPackingEntryId = ref<string | null>(null)
  const packErrorEntryIds = reactive(new Set<string>())
  const renameInput = useTemplateRef('renameInput')
  const editedName = ref('')
  const isRenameDialogVisible = ref(false)
  const nameErrorMessage = ref<string>()
  const renameErrorMessage = ref<string | null>(null)
  const renameAnnouncement = ref('')
  let isPageActive = true
  const nameLengthMessage = `Use ${limits.maxPackingListNameLength} characters or fewer.`

  const nameSchema = v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter a list name.'),
    v.maxLength(limits.maxPackingListNameLength, nameLengthMessage)
  )

  const packingListId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id ?? ''

  function createDefaultPackingList(): PackingListDetail {
    return {
      createdAt: '',
      entries: [],
      id: '',
      name: '',
      updatedAt: ''
    }
  }

  const {
    data: packingListResponse,
    error: packingListError,
    refresh: refreshPackingList,
    status: packingListStatus
  } = await useFetch(`/api/user/packing-lists/${packingListId}`, {
    default: createDefaultPackingList
  })

  if (packingListError.value === undefined) {
    packingListsStore.initializePackingListSummary(packingListResponse.value)
  }

  const packingListView = computed(() => packingListsStore.getPackingListDetailView(packingListResponse.value))
  const hasPackingListError = computed(() => packingListError.value !== undefined)
  const hasEntryRemoveError = computed(() => entryRemoveErrorMessage.value !== null)
  const isPackingListLoading = computed(() => packingListStatus.value === 'pending')
  const isComposerInitiallyOpen = packingListView.value.entries.length === 0
  const pageTitle = computed(() => packingListView.value.name === '' ? 'Packing list' : packingListView.value.name)
  const entryCount = computed(() => packingListView.value.entries.length)
  const packedCount = computed(() => packingListView.value.entries.filter((entry) => entry.isPacked).length)
  const isPackingListEmpty = computed(() => entryCount.value === 0)
  const packingProgressText = computed(() => formatPackingProgress(packedCount.value, entryCount.value))
  const isRenaming = computed(() => packingListsStore.isPackingListRenaming(packingListId))
  const canRenamePackingList = computed(() => !hasPackingListError.value && !isPackingListLoading.value && packingListView.value.id !== '')
  const isRenameDisabled = computed(() => isRenaming.value || editedName.value.trim() === packingListView.value.name)

  function isRemovingAnotherEntry(entryId: string) {
    const removingEntryId = packingListsStore.getRemovingPackingListEntryId(packingListId)

    return removingEntryId !== null && removingEntryId !== entryId
  }

  function latestUpdatedAt(current: string, incoming: Date | string) {
    const next = String(incoming)

    return current === '' || Date.parse(next) > Date.parse(current) ? next : current
  }

  function createCustomEntryView(entry: PackingListEntry): PackingListEntryView {
    const isPacking = packingListsStore.isPackingListEntryUpdating(packingListId, entry.id)
    const isRemoving = packingListsStore.isPackingListEntryRemoving(packingListId, entry.id)

    return {
      hasPackError: packErrorEntryIds.has(entry.id),
      id: entry.id,
      isPacked: entry.isPacked,
      isPackDisabled: isPacking || isRemoving,
      isPackFocusTarget: lastPackingEntryId.value === entry.id,
      isPacking,
      isRemoveDisabled: isRemovingAnotherEntry(entry.id) || isPacking,
      isRemoving,
      subtitle: '',
      title: entry.customName ?? 'Unnamed item'
    }
  }

  function createInventoryEntryView(entry: PackingListInventoryEntry): PackingListEntryView {
    const isPacking = packingListsStore.isPackingListEntryUpdating(packingListId, entry.id)
    const isRemoving = packingListsStore.isPackingListEntryRemoving(packingListId, entry.id)

    return {
      hasPackError: packErrorEntryIds.has(entry.id),
      id: entry.id,
      isPacked: entry.isPacked,
      isPackDisabled: isPacking || isRemoving,
      isPackFocusTarget: lastPackingEntryId.value === entry.id,
      isPacking,
      isRemoveDisabled: isRemovingAnotherEntry(entry.id) || isPacking,
      isRemoving,
      subtitle: `${entry.inventory.brand} / ${entry.inventory.category}`,
      title: entry.inventory.itemName
    }
  }

  function createPackingListEntryView(entry: PackingListEntry): PackingListEntryView {
    if (entry.source === 'inventory') {
      return createInventoryEntryView(entry)
    }

    return createCustomEntryView(entry)
  }

  const entryViews = computed(() => packingListView.value.entries.map(createPackingListEntryView))

  onBeforeUnmount(() => {
    isPageActive = false
  })

  async function openRenameDialog() {
    editedName.value = packingListView.value.name
    nameErrorMessage.value = undefined
    renameErrorMessage.value = null
    renameAnnouncement.value = ''
    isRenameDialogVisible.value = true

    await nextTick()
    renameInput.value?.focus()
  }

  async function handleRename() {
    if (isRenameDisabled.value) {
      return
    }

    const result = v.safeParse(nameSchema, editedName.value)

    nameErrorMessage.value = undefined
    renameErrorMessage.value = null

    if (!result.success) {
      nameErrorMessage.value = result.issues[0].message

      await nextTick()
      renameInput.value?.focus()

      return
    }

    try {
      const saved = await packingListsStore.renamePackingList(packingListId, result.output)

      if (!isPageActive) {
        return
      }

      const updatedAt = latestUpdatedAt(packingListResponse.value.updatedAt, saved.updatedAt)

      packingListResponse.value = {
        ...packingListResponse.value,
        name: saved.name,
        updatedAt
      }

      isRenameDialogVisible.value = false
      renameAnnouncement.value = 'Packing list renamed.'
    } catch (error) {
      console.error('Failed to rename packing list:', error)

      if (!isPageActive) {
        return
      }

      renameErrorMessage.value = 'Could not save the name. Try again.'

      await nextTick()

      if (isPageActive) {
        renameInput.value?.focus()
      }
    }
  }

  async function handleRetry() {
    await refreshPackingList()

    if (packingListError.value === undefined) {
      packingListsStore.initializePackingListSummary(packingListResponse.value)
    }
  }

  function handleEntryCreated(entry: PackingListEntry, packingListUpdatedAt: string) {
    packingListResponse.value = {
      createdAt: packingListResponse.value.createdAt,

      entries: [
        ...packingListResponse.value.entries,
        entry
      ],

      id: packingListResponse.value.id,
      name: packingListResponse.value.name,
      updatedAt: latestUpdatedAt(packingListResponse.value.updatedAt, packingListUpdatedAt)
    }
  }

  async function handlePackChange(entryId: string, isPacked: boolean) {
    if (packingListsStore.isPackingListEntryOperationPending(packingListId, entryId)) {
      return
    }

    const currentEntry = packingListView.value.entries.find((entry) => entry.id === entryId)

    if (currentEntry === undefined) {
      return
    }

    const previousIsPacked = currentEntry.isPacked

    lastPackingEntryId.value = entryId

    packErrorEntryIds.delete(entryId)

    const optimisticEntries = packingListResponse.value.entries.map((entry) => entry.id === entryId ? {
      ...entry,
      isPacked
    } : entry)

    packingListResponse.value = {
      ...packingListResponse.value,
      entries: optimisticEntries
    }

    try {
      const response = await packingListsStore.updatePackingListEntry({
        entryId,
        isPacked,
        packingListId,
        previousIsPacked
      })

      const confirmedEntries = packingListResponse.value.entries.map((entry) => entry.id === entryId ? response.entry : entry)

      packingListResponse.value = {
        ...packingListResponse.value,
        entries: confirmedEntries,
        updatedAt: latestUpdatedAt(packingListResponse.value.updatedAt, response.packingListUpdatedAt)
      }
    } catch {
      const restoredEntries = packingListResponse.value.entries.map((entry) => entry.id === entryId ? {
        ...entry,
        isPacked: previousIsPacked
      } : entry)

      packingListResponse.value = {
        ...packingListResponse.value,
        entries: restoredEntries
      }

      packErrorEntryIds.add(entryId)
    }
  }

  async function handleRemoveEntry(entryId: string) {
    const removingEntryId = packingListsStore.getRemovingPackingListEntryId(packingListId)

    if (removingEntryId !== null || packingListsStore.isPackingListEntryOperationPending(packingListId, entryId)) {
      return
    }

    entryRemoveErrorMessage.value = null

    const currentEntry = packingListView.value.entries.find((entry) => entry.id === entryId)

    if (currentEntry === undefined) {
      return
    }

    try {
      const response = await packingListsStore.deletePackingListEntry(
        packingListId,
        entryId,
        currentEntry.isPacked
      )

      packingListResponse.value = {
        createdAt: packingListResponse.value.createdAt,
        entries: packingListResponse.value.entries.filter((entry) => entry.id !== response.deletedEntryId),
        id: packingListResponse.value.id,
        name: packingListResponse.value.name,
        updatedAt: latestUpdatedAt(packingListResponse.value.updatedAt, response.packingListUpdatedAt)
      }

      packErrorEntryIds.delete(response.deletedEntryId)

      void entryComposerRef.value?.refreshAvailableGear()
    } catch {
      entryRemoveErrorMessage.value = 'Could not remove item.'
    }
  }
</script>

<style module>
  .component {
    /* Let the header shrink before wrapping long list names. */
    grid-template-columns: minmax(0, 1fr);
  }

  .body {
    display: grid;
    container-type: inline-size;
  }

  .content {
    display: grid;
    gap: var(--spacing-24);
  }

  .progress {
    color: var(--color-text-secondary);
    font-size: var(--font-size-16);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;

    &:global(.isEmpty) {
      position: absolute;
      overflow: hidden;
      inline-size: 1px;
      block-size: 1px;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  .entryList {
    display: grid;
    gap: var(--spacing-8);
    margin: 0;
    padding: 0;
  }

  .errorMessage {
    color: var(--color-danger-primary);
    font-size: var(--font-size-14);
  }

  .announcement {
    position: absolute;
    overflow: hidden;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
