<template>
  <PageContent page-title="Inventory">
    <template #actions>
      <PerdLink to="/catalog">
        Browse catalog
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading inventory"
        description="We are loading your saved gear right now."
      />

      <PagePlaceholder v-else-if="hasError" emoji="🎒" title="Inventory is temporarily unavailable.">
        We could not load your inventory right now. Try this request again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🧺" title="No saved gear yet.">
        Add an approved item from the catalog and it will show up here.
      </PagePlaceholder>

      <div v-else :class="$style.list">
        <InventorySummaryBar :summary-text="inventorySummaryText" />

        <p v-if="removeErrorMessage" :class="$style.errorMessage" role="status">
          {{ removeErrorMessage }}
        </p>

        <InventoryItemCard
          v-for="inventoryRow in inventoryItems"
          :key="inventoryRow.id"
          :inventory-row="inventoryRow"
          @remove="handleRemove"
        />
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { $fetch } from 'ofetch'
  import { definePageMeta, useFetch } from '#imports'
  import type { InventoryRecord } from '~/types/equipment'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import InventoryItemCard from '~/components/inventory/InventoryItemCard.vue'
  import InventorySummaryBar from '~/components/inventory/InventorySummaryBar.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const removeErrorMessage = ref<string | null>(null)
  const removingInventoryId = ref<string | null>(null)
  const inventoryDateFormatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium'
  })

  const {
    data: inventoryResponse,
    error: inventoryError,
    refresh: refreshInventory,
    status: inventoryStatus
  } = await useFetch<InventoryRecord[]>('/api/user/equipment', {
    default: () => []
  })

  const hasError = computed(() => inventoryError.value !== undefined && inventoryError.value !== null)
  const isInitialLoading = computed(() => inventoryStatus.value === 'pending')
  const isEmpty = computed(() => inventoryResponse.value.length === 0)
  const inventorySummaryText = computed(() => {
    const itemCount = inventoryResponse.value.length

    return `${itemCount} saved item${itemCount === 1 ? '' : 's'}`
  })

  function formatCreatedAt(createdAt: string) {
    return inventoryDateFormatter.format(new Date(createdAt))
  }

  function isRemovingAnotherItem(inventoryId: string) {
    return removingInventoryId.value !== null && removingInventoryId.value !== inventoryId
  }

  async function handleRetry() {
    await refreshInventory()
  }

  async function handleRemove(inventoryId: string) {
    if (removingInventoryId.value !== null) {
      return
    }

    removeErrorMessage.value = null
    removingInventoryId.value = inventoryId

    try {
      await $fetch(`/api/user/equipment/${inventoryId}`, {
        method: 'DELETE'
      })

      inventoryResponse.value = inventoryResponse.value.filter((inventoryRow) => inventoryRow.id !== inventoryId)
    } catch {
      removeErrorMessage.value = 'We could not remove this item from your inventory right now.'
    } finally {
      removingInventoryId.value = null
    }
  }

  const inventoryItems = computed(() => inventoryResponse.value.map((inventoryRow) => {
    return {
      catalogPath: `/catalog/${inventoryRow.item.id}`,
      createdAt: inventoryRow.createdAt,
      formattedCreatedAt: formatCreatedAt(inventoryRow.createdAt),
      id: inventoryRow.id,
      isRemoveDisabled: isRemovingAnotherItem(inventoryRow.id),
      isRemoving: removingInventoryId.value === inventoryRow.id,
      item: inventoryRow.item
    }
  }))
</script>

<style module>
  .component {
    display: grid;
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger);
  }

  .list {
    display: grid;
    gap: var(--spacing-24);
  }

</style>
