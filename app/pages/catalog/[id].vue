<template>
  <PageContent :page-title="pageTitle">
    <template #actions>
      <PerdLink to="/catalog">
        Back to catalog
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading item"
        description="We are loading this catalog item right now."
      />

      <PagePlaceholder v-else-if="hasItemError" emoji="🧭" title="This item is temporarily unavailable.">
        We could not load this catalog item right now. Try this request again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.content">
        <div :class="$style.topGrid">
          <div :class="$style.mainColumn">
            <CatalogItemMediaCard :category-name="itemResponse.category.name" />

            <CatalogItemSummaryCard
              :brand-name="itemResponse.brand.name"
              :category-name="itemResponse.category.name"
              :status-class="statusClass"
              :status-text="statusText"
            />
          </div>

          <CatalogItemOwnershipCard
            :action-icon="ownershipActionIcon"
            :action-text="ownershipActionText"
            :action-variant="ownershipActionVariant"
            :description="ownershipDescription"
            :error-message="ownershipErrorMessage"
            :has-inventory-error="hasInventoryError"
            :is-action-disabled="isOwnershipActionDisabled"
            :is-action-loading="isOwnershipActionLoading"
            :state-class="ownershipStateClass"
            :state-icon="ownershipStateIcon"
            :state-text="ownershipStateText"
            @ownership-action="handleOwnershipAction"
          />
        </div>

        <CatalogItemPropertiesCard :properties="displayProperties" />
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute } from '#imports'
  import type { ItemProperty } from '~/types/equipment'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import CatalogItemMediaCard from '~/components/catalog/CatalogItemMediaCard.vue'
  import CatalogItemOwnershipCard from '~/components/catalog/CatalogItemOwnershipCard.vue'
  import CatalogItemPropertiesCard from '~/components/catalog/CatalogItemPropertiesCard.vue'
  import CatalogItemSummaryCard from '~/components/catalog/CatalogItemSummaryCard.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const itemId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id

  const ownershipErrorMessage = ref<string | null>(null)
  const isOwnershipPending = ref(false)
  const $fetch = useRequestFetch()

  const {
    data: itemResponse,
    error: itemError,
    refresh: refreshItem,
    status: itemStatus
  } = await useFetch(`/api/equipment/items/${itemId}`, {
    default: () => {
      return {
        brand: {
          id: 0,
          name: '',
          slug: ''
        },

        category: {
          id: 0,
          name: '',
          slug: ''
        },

        createdAt: '',
        id: '',
        name: '',
        properties: [],
        status: ''
      }
    }
  })

  const {
    data: inventoryResponse,
    error: inventoryError,
    refresh: refreshInventory,
    status: inventoryStatus
  } = await useFetch('/api/user/equipment', {
    default: () => []
  })

  const hasItemError = computed(() => itemError.value !== undefined && itemError.value !== null)
  const isItemLoading = computed(() => itemStatus.value === 'pending')
  const isInventoryLoading = computed(() => inventoryStatus.value === 'pending')
  const hasInventoryError = computed(() => inventoryError.value !== undefined && inventoryError.value !== null)
  const isInitialLoading = computed(() => isItemLoading.value)

  function formatStatus(status: string) {
    if (status === '') {
      return 'Unknown'
    }

    return `${status.slice(0, 1).toUpperCase()}${status.slice(1)}`
  }

  function formatPropertyValue(property: ItemProperty) {
    if (property.value === null) {
      return 'Not set'
    }

    if (property.dataType === 'boolean') {
      return property.value === 'true' ? 'Yes' : 'No'
    }

    if (property.unit !== null && property.unit !== '') {
      return `${property.value} ${property.unit}`
    }

    return property.value
  }

  const pageTitle = computed(() => itemResponse.value.name === '' ? 'Catalog item' : itemResponse.value.name)
  const statusText = computed(() => formatStatus(itemResponse.value.status))
  const statusClass = computed(() => {
    if (itemResponse.value.status === 'approved') {
      return 'approved'
    }

    if (itemResponse.value.status === 'rejected') {
      return 'rejected'
    }

    return 'pending'
  })
  const ownedInventoryRow = computed(() => inventoryResponse.value.find((inventoryRow) => inventoryRow.item.id === itemResponse.value.id))
  const isOwned = computed(() => ownedInventoryRow.value !== undefined)
  const isOwnershipActionLoading = computed(() => isInventoryLoading.value || isOwnershipPending.value)
  const isOwnershipActionDisabled = computed(() => isOwnershipActionLoading.value || hasInventoryError.value || itemResponse.value.id === '')
  const ownershipActionText = computed(() => {
    if (isInventoryLoading.value) {
      return 'Loading inventory'
    }

    return isOwned.value ? 'Remove from inventory' : 'I have this'
  })
  const ownershipActionVariant = computed(() => isOwned.value ? 'danger' : 'primary')
  const ownershipActionIcon = computed(() => isOwned.value ? 'tabler:trash' : 'tabler:backpack')
  const ownershipStateText = computed(() => {
    if (isInventoryLoading.value) {
      return 'Checking saved gear'
    }

    if (hasInventoryError.value) {
      return 'Inventory unavailable'
    }

    return isOwned.value ? 'In your inventory' : 'Not in inventory'
  })
  const ownershipStateIcon = computed(() => {
    if (isInventoryLoading.value) {
      return 'tabler:hourglass-empty'
    }

    if (hasInventoryError.value) {
      return 'tabler:alert-circle'
    }

    return isOwned.value ? 'tabler:check' : 'tabler:circle-dashed'
  })
  const ownershipStateClass = computed(() => {
    if (isInventoryLoading.value) {
      return 'pending'
    }

    if (hasInventoryError.value) {
      return 'error'
    }

    return isOwned.value ? 'owned' : 'missing'
  })
  const ownershipDescription = computed(() => {
    if (isInventoryLoading.value) {
      return 'We are syncing your saved gear so this action stays accurate.'
    }

    if (hasInventoryError.value) {
      return 'The item loaded, but your inventory state did not. The control stays stable until that state is available again.'
    }

    return isOwned.value
      ? 'This item is already part of your saved gear. Remove it here if you no longer own it.'
      : 'Save this item to your personal inventory so it is ready for future packing workflows.'
  })
  const displayProperties = computed(() => itemResponse.value.properties.map((property) => {
    return {
      dataType: property.dataType,
      displayValue: formatPropertyValue(property),
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      value: property.value
    }
  }))

  async function handleRetry() {
    await Promise.all([
      refreshItem(),
      refreshInventory()
    ])
  }

  async function handleOwnershipAction() {
    if (isOwnershipActionDisabled.value) {
      return
    }

    ownershipErrorMessage.value = null
    isOwnershipPending.value = true
    const ownedBeforeRequest = isOwned.value
    const inventoryRowId = ownedInventoryRow.value?.id

    try {
      if (ownedBeforeRequest === false) {
        const createdInventoryRow = await $fetch('/api/user/equipment', {
          method: 'POST',

          body: {
            itemId: itemResponse.value.id
          }
        })

        inventoryResponse.value = [
          createdInventoryRow,
          ...inventoryResponse.value.filter((inventoryRow) => inventoryRow.item.id !== createdInventoryRow.item.id)
        ]
      } else if (inventoryRowId !== undefined) {
        await $fetch(`/api/user/equipment/${inventoryRowId}`, {
          method: 'DELETE'
        })

        inventoryResponse.value = inventoryResponse.value.filter((inventoryRow) => inventoryRow.id !== inventoryRowId)
      }
    } catch {
      ownershipErrorMessage.value = ownedBeforeRequest === false
        ? 'We could not add this item to your inventory right now.'
        : 'We could not remove this item from your inventory right now.'
    } finally {
      isOwnershipPending.value = false
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

  .topGrid {
    display: grid;
    gap: var(--spacing-24);

    @container (inline-size >= 60rem) {
      grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.95fr);
      align-items: start;
    }
  }

  .mainColumn {
    display: grid;
    gap: var(--spacing-24);
  }

</style>
