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
        <PagePlaceholder v-if="isEmpty" emoji="🧾" title="No items yet." />

        <ul v-else :class="$style.entryList">
          <PackingListEntryCard
            v-for="entry in entryViews"
            :key="entry.id"
            :entry="entry"
          />
        </ul>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, useFetch, useRoute } from '#imports'
  import type { PackingListDetail, PackingListEntry, PackingListEntryView, PackingListInventoryEntry } from '~/types/packing'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PackingListEntryCard from '~/components/packing-lists/PackingListEntryCard.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()

  const packingListId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id

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
  const isPackingListLoading = computed(() => packingListStatus.value === 'pending')
  const isEmpty = computed(() => packingListResponse.value.entries.length === 0)
  const pageTitle = computed(() => packingListResponse.value.name === '' ? 'Packing list' : packingListResponse.value.name)

  function createCustomEntryView(entry: PackingListEntry): PackingListEntryView {
    return {
      id: entry.id,
      isPacked: entry.isPacked,
      packedStatusText: entry.isPacked ? 'Packed' : 'Unpacked',
      sourceText: 'Custom item',
      subtitle: '',
      title: entry.customName ?? 'Unnamed item'
    }
  }

  function createInventoryEntryView(entry: PackingListInventoryEntry): PackingListEntryView {
    return {
      id: entry.id,
      isPacked: entry.isPacked,
      packedStatusText: entry.isPacked ? 'Packed' : 'Unpacked',
      sourceText: 'My gear',
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
    gap: var(--spacing-16);
    padding: 0;
  }
</style>
