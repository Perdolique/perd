<template>
  <PageContent :page-title="navigationLabels.packingLists">
    <template v-if="showHeaderCreateAction" #actions>
      <PerdButton
        id="new-packing-list-dialog-invoker"
        size="small"
        icon="hugeicons:add-01"
        :disabled="isHeaderCreateDisabled"
        aria-haspopup="dialog"
        @click="openCreateDialog"
      >
        New list
      </PerdButton>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading packing lists"
      />

      <PagePlaceholder v-else-if="hasError" emoji="🎒" title="Packing lists unavailable.">
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🧾" title="No packing lists yet." />

      <div v-else :class="$style.list">
        <PackingListCard
          v-for="packingList in packingListViews"
          :key="packingList.id"
          :packing-list="packingList"
        />
      </div>
    </div>

    <PackingListCreateDialog
      v-model="isCreateDialogVisible"
      v-model:name="newListName"
      :loading="creatingList"
      :error-message="createErrorMessage"
      invoker-id="new-packing-list-dialog-invoker"
      @create="handleCreate"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { storeToRefs } from 'pinia'
  import { definePageMeta } from '#imports'
  import type { PackingListSummary, PackingListView } from '~/types/packing'
  import { navigationLabels } from '~/utils/navigation'
  import { packingListDateFormatter } from '~/utils/packing'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PackingListCard from '~/components/packing-lists/PackingListCard.vue'
  import PackingListCreateDialog from '~/components/packing-lists/PackingListCreateDialog.vue'

  definePageMeta({
    layout: 'page'
  })

  const packingListsStore = usePackingListsStore()
  const {
    hasUnavailableError,
    isEmpty,
    isInitialLoading,
    rows: packingLists
  } = storeToRefs(packingListsStore)
  const newListName = ref('')
  const createErrorMessage = ref<string | null>(null)
  const creatingList = ref(false)
  const isCreateDialogVisible = ref(false)

  void packingListsStore.fetchPackingLists()

  const hasError = computed(() => hasUnavailableError.value)
  const isCreateDisabled = computed(() => newListName.value.trim() === '' || creatingList.value)
  const isHeaderCreateDisabled = computed(() => isInitialLoading.value || creatingList.value)
  const showHeaderCreateAction = computed(() => hasError.value === false)

  function formatUpdatedAt(updatedAt: string) {
    return packingListDateFormatter.format(new Date(updatedAt))
  }

  function createPackingListView(row: PackingListSummary): PackingListView {
    return {
      createdAt: row.createdAt,
      entryCount: row.entryCount,
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
      formattedUpdatedAt: formatUpdatedAt(row.updatedAt)
    }
  }

  const packingListViews = computed(() => packingLists.value.map(createPackingListView))

  function openCreateDialog() {
    createErrorMessage.value = null
    isCreateDialogVisible.value = true
  }

  async function handleRetry() {
    await packingListsStore.fetchPackingLists()
  }

  async function handleCreate() {
    if (isCreateDisabled.value) {
      return
    }

    createErrorMessage.value = null
    creatingList.value = true

    try {
      await packingListsStore.createPackingList(newListName.value)

      newListName.value = ''
      isCreateDialogVisible.value = false
    } catch {
      createErrorMessage.value = 'Could not create list.'
    } finally {
      creatingList.value = false
    }
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
    container-type: inline-size;
  }

  .list {
    display: grid;
    gap: var(--spacing-16);
  }
</style>
