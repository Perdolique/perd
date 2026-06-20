<template>
  <PageContent page-title="Inventory">
    <template #actions>
      <PerdButton icon="tabler:plus" @click="openSubmissionDialog">
        Add gear
      </PerdButton>

      <PerdLink to="/catalog">
        Browse catalog
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading inventory"
      />

      <PagePlaceholder v-else-if="hasError" emoji="🎒" title="Inventory unavailable.">
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🧺" title="No saved gear yet." />

      <div v-else :class="$style.list">
        <p v-if="submittedItemName" :class="$style.successMessage" role="status">
          Submitted {{ submittedItemName }} for review.
        </p>

        <PageSummaryHeader label="My gear" :value="inventorySummaryText" />

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

    <EquipmentItemSubmissionDialog
      v-model="isSubmissionDialogVisible"
      @submitted="handleSubmissionSubmitted"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch } from '#imports'
  import type { ItemSubmissionCreateResponse } from '~/types/equipment'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PageSummaryHeader from '~/components/PageSummaryHeader.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import EquipmentItemSubmissionDialog from '~/components/equipment/EquipmentItemSubmissionDialog.vue'
  import InventoryItemCard from '~/components/inventory/InventoryItemCard.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const removeErrorMessage = ref<string | null>(null)
  const removingInventoryId = ref<string | null>(null)
  const isSubmissionDialogVisible = ref(false)
  const submittedItemName = ref<string | null>(null)
  const $fetch = useRequestFetch()
  const inventoryDateFormatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium'
  })

  const {
    data: inventoryResponse,
    error: inventoryError,
    refresh: refreshInventory,
    status: inventoryStatus
  } = await useFetch('/api/user/equipment', {
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
      removeErrorMessage.value = 'Could not remove item.'
    } finally {
      removingInventoryId.value = null
    }
  }

  function openSubmissionDialog() {
    isSubmissionDialogVisible.value = true
  }

  function handleSubmissionSubmitted(response: ItemSubmissionCreateResponse) {
    submittedItemName.value = response.item.name
    inventoryResponse.value = [
      response.inventory,
      ...inventoryResponse.value.filter((inventoryRow) => inventoryRow.id !== response.inventory.id)
    ]
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
    color: var(--color-danger-primary);
  }

  .successMessage {
    margin: 0;
    padding: var(--spacing-12);
    border: 1px solid var(--color-success-subtle);
    border-radius: var(--border-radius-12);
    background: var(--color-success-subtle);
    color: var(--color-text-primary);
  }

  .list {
    display: grid;
    gap: var(--spacing-24);
  }

</style>
