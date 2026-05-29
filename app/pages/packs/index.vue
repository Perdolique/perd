<template>
  <PageContent page-title="Packs">
    <template v-if="showHeaderCreateAction" #actions>
      <PerdButton
        icon="tabler:plus"
        :disabled="creatingList"
        aria-haspopup="dialog"
        @click="openCreateDialog"
      >
        New pack
      </PerdButton>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading packs"
      />

      <PagePlaceholder v-else-if="hasError" emoji="🎒" title="Packs unavailable.">
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🧭" title="No packs yet.">
        <template #actions>
          <PerdButton
            icon="tabler:plus"
            :disabled="creatingList"
            aria-haspopup="dialog"
            @click="openCreateDialog"
          >
            New pack
          </PerdButton>
        </template>
      </PagePlaceholder>

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
      @create="handleCreate"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useRequestFetch } from '#imports'
  import type { PackingListSummary, PackingListView } from '~/types/packing'
  import { packingListDateFormatter } from '~/utils/packing'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PackingListCard from '~/components/packing/PackingListCard.vue'
  import PackingListCreateDialog from '~/components/packing/PackingListCreateDialog.vue'

  definePageMeta({
    layout: 'page'
  })

  const requestFetch = useRequestFetch()
  const newListName = ref('')
  const createErrorMessage = ref<string | null>(null)
  const creatingList = ref(false)
  const isCreateDialogVisible = ref(false)

  const {
    data: packingLists,
    error: packingListError,
    refresh: refreshPackingLists,
    status: packingListStatus
  } = await useFetch('/api/user/packing-lists', {
    default: () => [],
    lazy: true
  })

  const hasError = computed(() => packingListError.value !== undefined && packingListError.value !== null)
  const isCreateDisabled = computed(() => newListName.value.trim() === '' || creatingList.value)
  const isEmpty = computed(() => packingLists.value.length === 0)
  const isInitialLoading = computed(() => packingListStatus.value === 'pending')
  const showHeaderCreateAction = computed(() => isEmpty.value === false)

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
    await refreshPackingLists()
  }

  async function handleCreate() {
    if (isCreateDisabled.value) {
      return
    }

    createErrorMessage.value = null
    creatingList.value = true

    try {
      const createdList = await requestFetch('/api/user/packing-lists', {
        method: 'POST',

        body: {
          name: newListName.value
        }
      })

      const createdListSummary = {
        createdAt: createdList.createdAt,
        entryCount: 0,
        id: createdList.id,
        name: createdList.name,
        updatedAt: createdList.updatedAt
      }

      packingLists.value = [createdListSummary, ...packingLists.value]
      newListName.value = ''
      isCreateDialogVisible.value = false

      await navigateTo(`/packs/${createdList.id}`)
    } catch {
      createErrorMessage.value = 'Could not create pack.'
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
