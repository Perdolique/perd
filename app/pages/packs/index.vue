<template>
  <PageContent page-title="Packs">
    <template v-if="showHeaderCreateAction" #actions>
      <PerdButton
        icon="tabler:plus"
        :disabled="isNewPackButtonDisabled"
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
        description="We are loading your packs right now."
      />

      <PagePlaceholder v-else-if="hasError" emoji="🎒" title="Packs are temporarily unavailable.">
        We could not load your packs right now. Try this request again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🧭" title="No packs yet.">
        Create the first pack when you are ready.

        <template #actions>
          <PerdButton
            icon="tabler:plus"
            :disabled="isCreateInFlight"
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
      :loading="isCreateInFlight"
      :error-message="createErrorMessage"
      @create="handleCreate"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useRequestFetch } from '#imports'
  import type { PackingListSummary, PackingListView } from '~/types/packing'
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
  const packingListDateFormatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium'
  })

  const {
    data: packingLists,
    error: packingListError,
    refresh: refreshPackingLists,
    status: packingListStatus
  } = await useFetch('/api/user/packing-lists', {
    default: () => []
  })

  const hasError = computed(() => packingListError.value !== undefined && packingListError.value !== null)
  const isCreateInFlight = computed(() => creatingList.value)
  const isCreateDisabled = computed(() => newListName.value.trim() === '' || creatingList.value)
  const isEmpty = computed(() => packingLists.value.length === 0)
  const isInitialLoading = computed(() => packingListStatus.value === 'pending')
  const isNewPackButtonDisabled = computed(() => creatingList.value)
  const showHeaderCreateAction = computed(() => isEmpty.value === false)

  function formatUpdatedAt(updatedAt: string) {
    return packingListDateFormatter.format(new Date(updatedAt))
  }

  function createPackingListView(row: PackingListSummary): PackingListView {
    return {
      ...row,
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

      packingLists.value = [createdList, ...packingLists.value]
      newListName.value = ''
      isCreateDialogVisible.value = false

      await navigateTo(`/packs/${createdList.id}`)
    } catch {
      createErrorMessage.value = 'We could not create this pack right now.'
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
