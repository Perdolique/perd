<template>
  <PageContent :page-title="pageTitle">
    <div :class="$style.component">
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
        <ul :class="$style.entryList">
          <PackingListEntryCard
            v-for="entry in entryViews"
            :key="entry.id"
            :entry="entry"
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
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute } from '#imports'
  import type { PackingListDetail, PackingListEntry, PackingListEntryView, PackingListInventoryEntry } from '~/types/packing'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PackingListEntryComposer from '~/components/packing-lists/PackingListEntryComposer.vue'
  import PackingListEntryCard from '~/components/packing-lists/PackingListEntryCard.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const requestFetch = useRequestFetch()
  const entryComposerRef = useTemplateRef('entryComposer')
  const removingEntryId = ref<string | null>(null)
  const entryRemoveErrorMessage = ref<string | null>(null)

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

  const hasPackingListError = computed(() => packingListError.value !== undefined)
  const hasEntryRemoveError = computed(() => entryRemoveErrorMessage.value !== null)
  const isPackingListLoading = computed(() => packingListStatus.value === 'pending')
  const isComposerInitiallyOpen = packingListResponse.value.entries.length === 0
  const pageTitle = computed(() => packingListResponse.value.name === '' ? 'Packing list' : packingListResponse.value.name)

  function isRemovingAnotherEntry(entryId: string) {
    return removingEntryId.value !== null && removingEntryId.value !== entryId
  }

  function createCustomEntryView(entry: PackingListEntry): PackingListEntryView {
    return {
      id: entry.id,
      isRemoveDisabled: isRemovingAnotherEntry(entry.id),
      isRemoving: removingEntryId.value === entry.id,
      subtitle: '',
      title: entry.customName ?? 'Unnamed item'
    }
  }

  function createInventoryEntryView(entry: PackingListInventoryEntry): PackingListEntryView {
    return {
      id: entry.id,
      isRemoveDisabled: isRemovingAnotherEntry(entry.id),
      isRemoving: removingEntryId.value === entry.id,
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

  const entryViews = computed(() => packingListResponse.value.entries.map(createPackingListEntryView))

  async function handleRetry() {
    await refreshPackingList()
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
      updatedAt: packingListUpdatedAt
    }
  }

  async function handleRemoveEntry(entryId: string) {
    if (removingEntryId.value !== null) {
      return
    }

    entryRemoveErrorMessage.value = null
    removingEntryId.value = entryId

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries/${entryId}`, {
        method: 'DELETE'
      })

      packingListResponse.value = {
        createdAt: packingListResponse.value.createdAt,
        entries: packingListResponse.value.entries.filter((entry) => entry.id !== response.deletedEntryId),
        id: packingListResponse.value.id,
        name: packingListResponse.value.name,
        updatedAt: String(response.packingListUpdatedAt)
      }

      void entryComposerRef.value?.refreshAvailableGear()
    } catch {
      entryRemoveErrorMessage.value = 'Could not remove item.'
    } finally {
      removingEntryId.value = null
    }
  }
</script>

<style module>
  .component {
    display: grid;
    container-type: inline-size;
  }

  .content {
    display: grid;
    gap: var(--spacing-24);
  }

  .entryList {
    display: grid;
    gap: var(--spacing-8);
    margin: 0;
    padding: 0;
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
    font-size: var(--font-size-14);
  }
</style>
