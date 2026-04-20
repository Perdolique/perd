<template>
  <PageContent page-title="Inventory">
    <template #actions>
      <PerdLink to="/catalog">
        Browse catalog
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PerdCard v-if="isInitialLoading" :class="$style.stateCard">
        <div :class="$style.stateBody">
          <FidgetSpinner :class="$style.spinner" />

          <PerdHeading :level="2">
            Loading inventory
          </PerdHeading>

          <p :class="$style.stateText">
            We are loading your saved gear right now.
          </p>
        </div>
      </PerdCard>

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
        <div :class="$style.summaryBar">
          <div>
            <p :class="$style.summaryLabel">
              My gear
            </p>

            <p :class="$style.summaryCount">
              {{ inventorySummaryText }}
            </p>
          </div>

          <p :class="$style.summaryCopy">
            Everything already in your kit, ready to revisit from the catalog.
          </p>
        </div>

        <p v-if="removeErrorMessage" :class="$style.errorMessage" role="status">
          {{ removeErrorMessage }}
        </p>

        <PerdCard
          v-for="inventoryRow in inventoryItems"
          :key="inventoryRow.id"
          :class="$style.itemCard"
        >
          <div :class="$style.itemHeader">
            <div :class="$style.itemInfo">
              <div :class="$style.itemTitleRow">
                <span :class="$style.itemIcon" aria-hidden="true">
                  <Icon name="tabler:backpack" />
                </span>

                <div :class="$style.itemTitleBlock">
                  <p :class="$style.itemBrand">
                    {{ inventoryRow.item.brand.name }}
                  </p>

                  <PerdLink :to="inventoryRow.catalogPath">
                    {{ inventoryRow.item.name }}
                  </PerdLink>
                </div>
              </div>

              <div :class="$style.itemTags">
                <p :class="$style.itemTag">
                  {{ inventoryRow.item.brand.name }}
                </p>

                <p :class="$style.itemTag">
                  {{ inventoryRow.item.category.name }}
                </p>
              </div>
            </div>

            <div :class="$style.itemActions">
              <p :class="$style.itemMeta">
                Added <time :datetime="inventoryRow.createdAt">{{ inventoryRow.formattedCreatedAt }}</time>
              </p>

              <PerdButton
                size="sm"
                variant="danger"
                icon="tabler:trash"
                :loading="inventoryRow.isRemoving"
                :disabled="inventoryRow.isRemoveDisabled"
                @click="inventoryRow.handleRemoveClick"
              >
                Remove
              </PerdButton>
            </div>
          </div>
        </PerdCard>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { $fetch } from 'ofetch'
  import { definePageMeta, useFetch } from '#imports'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  interface InventoryItemBrand {
    name: string;
    slug: string;
  }

  interface InventoryItemCategory {
    name: string;
    slug: string;
  }

  interface InventoryItem {
    brand: InventoryItemBrand;
    category: InventoryItemCategory;
    id: string;
    name: string;
  }

  interface InventoryRecord {
    createdAt: string;
    id: string;
    item: InventoryItem;
  }

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
      handleRemoveClick: () => void handleRemove(inventoryRow.id),
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

  .stateCard {
    min-height: min(60vh, 32rem);
    display: grid;
    place-items: center;
  }

  .stateBody {
    display: grid;
    gap: var(--spacing-16);
    justify-items: center;
    text-align: center;
  }

  .spinner {
    font-size: 2rem;
  }

  .stateText,
  .itemMeta {
    margin: 0;
    color: var(--color-text-tertiary);
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger);
  }

  .list {
    display: grid;
    gap: var(--spacing-24);
  }

  .summaryBar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-16);
    align-items: end;
  }

  .summaryLabel,
  .summaryCount,
  .summaryCopy {
    margin: 0;
  }

  .summaryLabel {
    margin-bottom: var(--spacing-8);
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .summaryCount {
    color: var(--color-text-primary);
    font-size: var(--font-size-24);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
  }

  .summaryCopy {
    max-width: 24rem;
    color: var(--color-text-tertiary);
    text-align: right;
  }

  .itemCard {
    display: grid;
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-accent-base), transparent 94%),
        var(--color-surface-base)
      );
  }

  .itemHeader {
    display: grid;
    gap: var(--spacing-16);

    @media (width >= 640px) {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }
  }

  .itemInfo {
    display: grid;
    gap: var(--spacing-8);
  }

  .itemTitleRow {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
  }

  .itemTitleBlock {
    min-width: 0;
    display: grid;
    gap: 0.12rem;
  }

  .itemBrand {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .itemIcon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--border-radius-16);
    background-color: var(--color-accent-subtle);
    color: var(--color-accent-base);
    font-size: 1.1rem;
  }

  .itemTags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);
  }

  .itemTag {
    margin: 0;
    padding: var(--spacing-4) var(--spacing-12);
    border-radius: 999px;
    background-color: var(--color-surface-subtle);
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    border: 1px solid var(--color-border-subtle);
  }

  .itemActions {
    display: grid;
    gap: var(--spacing-12);
    align-items: start;
    justify-items: start;

    @media (width >= 640px) {
      justify-items: end;
      text-align: right;
    }
  }

  @media (width < 640px) {
    .summaryCopy {
      text-align: left;
    }
  }
</style>
