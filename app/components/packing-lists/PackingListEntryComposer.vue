<template>
  <li :class="$style.component">
    <details
      ref="details"
      :class="$style.details"
      :open="initiallyOpen"
      @toggle="handleToggle"
    >
      <summary ref="summary" :class="$style.summary" @click="handleSummaryClick">
        <span :class="$style.summaryIcon" aria-hidden="true">
          <Icon name="hugeicons:add-01" />
        </span>

        <span :class="$style.summaryText">
          <span :class="$style.summaryTitle">{{ summaryTitle }}</span>
          <span :class="$style.summaryDescription">Search My gear or add a custom item.</span>
        </span>

        <Icon :name="summaryChevron" :class="$style.summaryChevron" aria-hidden="true" />
      </summary>

      <div :class="$style.panel" @keydown.esc.prevent.stop="handleEscape">
        <form :class="$style.searchForm" role="search" @submit.prevent="handleSearchSubmit">
          <label :class="$style.inputLabel" for="packing-list-entry-search">
            Find an item
          </label>

          <p id="packing-list-entry-search-hint" :class="$style.inputHint">
            Search by item, brand, or category. Your text can also become a custom item.
          </p>

          <div :class="$style.inputShell">
            <Icon name="hugeicons:search-01" :class="$style.inputIcon" aria-hidden="true" />

            <input
              id="packing-list-entry-search"
              ref="searchInput"
              v-model="searchQuery"
              :class="$style.input"
              :disabled="isMutationPending"
              :maxlength="maxCustomNameLength"
              aria-describedby="packing-list-entry-search-hint"
              name="search"
              type="text"
              autocomplete="off"
              enterkeyhint="search"
              placeholder="PocketRocket, MSR, Stoves…"
            >

            <FidgetSpinner v-if="isInitialLoading" :class="$style.spinner" />
          </div>
        </form>

        <div :class="$style.results" :aria-busy="ariaBusy">
          <ul v-if="hasAvailableItems" :class="$style.resultList">
            <li
              v-for="item in availableGearItemViews"
              :key="item.inventoryId"
              :class="$style.resultItem"
            >
              <button
                type="button"
                :class="$style.resultButton"
                :disabled="isResultActionDisabled"
                @click="handleCreateInventoryEntry(item)"
              >
                <span :class="$style.resultText">
                  <span :class="$style.resultName">{{ item.itemName }}</span>
                  <span :class="$style.resultMeta">{{ item.meta }}</span>
                </span>

                <FidgetSpinner v-if="item.isLoading" :class="$style.spinner" />
                <span v-else :class="$style.resultAction">Add</span>
              </button>
            </li>
          </ul>

          <p v-if="showEmptyMessage" :class="$style.helperMessage">
            {{ emptyMessage }}
          </p>

          <button
            v-if="showCustomAction"
            type="button"
            :class="[$style.resultButton, $style.customButton]"
            :disabled="isResultActionDisabled"
            @click="handleCreateCustomEntry"
          >
            <span :class="$style.customIcon" aria-hidden="true">
              <Icon name="hugeicons:add-circle" />
            </span>

            <span :class="$style.customText">{{ customActionText }}</span>
            <FidgetSpinner v-if="isCreatingCustomEntry" :class="$style.spinner" />
          </button>

          <div v-if="hasLoadError" :class="$style.messageBlock">
            <p :class="$style.errorMessage" role="alert">
              {{ loadErrorMessage }}
            </p>

            <PerdButton size="small" variant="secondary" @click="handleRetryLoad">
              Retry
            </PerdButton>
          </div>

          <p v-if="hasLoadMoreError" :class="$style.errorMessage" role="alert">
            {{ loadMoreErrorMessage }}
          </p>

          <PerdButton
            v-if="showLoadMore"
            size="small"
            variant="secondary"
            :loading="isLoadingMore"
            :disabled="isMutationPending"
            @click="handleLoadMore"
          >
            Load more
          </PerdButton>

          <p v-if="hasMutationError" :class="$style.errorMessage" role="alert">
            {{ mutationErrorMessage }}
          </p>
        </div>
      </div>
    </details>
  </li>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onMounted, useTemplateRef } from 'vue'
  import { limits } from '#shared/constants'
  import type { PackingListAvailableGearItem, PackingListEntry } from '~/types/packing'
  import { usePackingListEntryComposer } from '~/composables/use-packing-list-entry-composer'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    initiallyOpen?: boolean;
    packingListId: string;
  }

  interface AvailableGearItemView extends PackingListAvailableGearItem {
    isLoading: boolean;
    meta: string;
  }

  type Emits = (event: 'created', entry: PackingListEntry, packingListUpdatedAt: string) => void

  const {
    initiallyOpen = false,
    packingListId
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()
  const detailsRef = useTemplateRef('details')
  const summaryRef = useTemplateRef('summary')
  const searchInput = useTemplateRef('searchInput')
  const maxCustomNameLength = limits.maxPackingListEntryCustomNameLength

  function handleCreated(entry: PackingListEntry, packingListUpdatedAt: string) {
    emit('created', entry, packingListUpdatedAt)
  }

  const {
    ariaBusy,
    availableGearItems,
    closeComposer,
    createCustomEntry,
    createInventoryEntry,
    creatingInventoryId,
    customActionText,
    emptyMessage,
    hasAvailableItems,
    hasLoadError,
    hasLoadMoreError,
    hasMutationError,
    isCreatingCustomEntry,
    isInitialLoading,
    isLoadingMore,
    isMutationPending,
    isOpen,
    isResultActionDisabled,
    loadErrorMessage,
    loadFirstPage,
    loadMore,
    loadMoreErrorMessage,
    mutationErrorMessage,
    openComposer,
    searchQuery,
    showCustomAction,
    showEmptyMessage,
    showLoadMore
  } = usePackingListEntryComposer({
    initiallyOpen,
    onCreated: handleCreated,
    packingListId
  })

  const summaryTitle = computed(() => isOpen.value ? 'Add another item' : 'Add item')
  const summaryChevron = computed(() => isOpen.value ? 'hugeicons:arrow-up-01' : 'hugeicons:arrow-down-01')
  const availableGearItemViews = computed<AvailableGearItemView[]>(() => availableGearItems.value.map((item) => {
    return {
      brand: item.brand,
      category: item.category,
      inventoryId: item.inventoryId,
      isLoading: creatingInventoryId.value === item.inventoryId,
      itemName: item.itemName,
      meta: `${item.brand} · ${item.category}`
    }
  }))

  async function focusSearchInput() {
    await nextTick()
    searchInput.value?.focus()
  }

  async function handleToggle() {
    const nextIsOpen = detailsRef.value?.open ?? false
    const wasOpen = isOpen.value

    if (nextIsOpen === false) {
      closeComposer()

      return
    }

    if (wasOpen) {
      return
    }

    await openComposer()
    await focusSearchInput()
  }

  function handleSummaryClick(event: MouseEvent) {
    const isClosingDuringMutation = isOpen.value && isMutationPending.value

    if (isClosingDuringMutation) {
      event.preventDefault()
    }
  }

  async function handleEscape() {
    if (isMutationPending.value) {
      return
    }

    const details = detailsRef.value

    if (details === null) {
      return
    }

    details.open = false
    closeComposer()

    await nextTick()
    summaryRef.value?.focus()
  }

  async function handleSearchSubmit() {
    await loadFirstPage(true)
  }

  async function handleRetryLoad() {
    await loadFirstPage(true)
  }

  async function handleLoadMore() {
    await loadMore()
  }

  async function handleCreateInventoryEntry(item: PackingListAvailableGearItem) {
    const wasCreated = await createInventoryEntry(item)

    if (wasCreated) {
      await focusSearchInput()
    }
  }

  async function handleCreateCustomEntry() {
    const wasCreated = await createCustomEntry()

    if (wasCreated) {
      await focusSearchInput()
    }
  }

  async function refreshAvailableGear() {
    if (isOpen.value === false) {
      return
    }

    await loadFirstPage(true)
  }

  defineExpose({
    refreshAvailableGear
  })

  onMounted(() => {
    if (initiallyOpen) {
      void loadFirstPage(true)
    }
  })
</script>

<style module>
  .component {
    list-style: none;
  }

  .details {
    overflow: clip;
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--border-radius-20);
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-accent-subtle), transparent 74%),
        var(--color-surface-primary)
      );
    transition:
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:has(> .summary:focus-visible) {
      border-color: var(--color-accent-primary);
      border-style: solid;
      box-shadow: var(--shadow-focus);
    }

    &[open] {
      border-style: solid;
      box-shadow: var(--shadow-small);
    }
  }

  .summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-12);
    min-block-size: var(--layout-button-height-medium);
    padding: var(--spacing-12) var(--spacing-16);
    color: var(--color-text-primary);
    cursor: pointer;
    list-style: none;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &::marker {
      content: '';
    }

    &:hover {
      background: var(--color-surface-secondary);
    }

    &:focus-visible {
      box-shadow: none;
    }
  }

  .summaryIcon,
  .customIcon {
    display: inline-grid;
    place-items: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--border-radius-16);
    background: var(--color-accent-subtle);
    color: var(--color-accent-primary);
    font-size: 1.1rem;
  }

  .summaryText,
  .resultText {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .summaryTitle,
  .resultName,
  .customText {
    font-weight: var(--font-weight-semibold);
    overflow-wrap: anywhere;
  }

  .summaryDescription,
  .resultMeta,
  .inputHint {
    color: var(--color-text-muted);
    font-size: var(--font-size-14);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .summaryChevron,
  .spinner,
  .inputIcon {
    color: var(--color-text-muted);
  }

  .summaryChevron {
    flex-shrink: 0;
    font-size: var(--font-size-20);
  }

  .spinner {
    flex-shrink: 0;
    font-size: 1rem;
  }

  .inputIcon {
    flex: 0 0 1rem;
    inline-size: 1rem;
    block-size: 1rem;
    font-size: 1rem;
  }

  .panel {
    display: grid;
    gap: var(--spacing-16);
    padding: var(--spacing-16);
    border-block-start: 1px solid var(--color-border-subtle);
  }

  .searchForm,
  .results {
    display: grid;
    gap: var(--spacing-12);
  }

  .inputLabel {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-semibold);
  }

  .inputHint,
  .helperMessage,
  .errorMessage {
    margin: 0;
  }

  .inputShell {
    display: flex;
    align-items: center;
    gap: var(--spacing-8);
    min-block-size: 3rem;
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background: var(--color-background-elevated);
    color: var(--color-text-primary);
    transition:
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:focus-within {
      border-color: var(--color-accent-primary);
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }
  }

  .input {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 2.75rem;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--color-text-primary);
    font: inherit;
    outline: 0;

    &::placeholder {
      color: var(--color-text-muted);
    }
  }

  .resultList {
    display: grid;
    gap: var(--spacing-8);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .resultItem {
    list-style: none;
  }

  .resultButton {
    appearance: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-12);
    inline-size: 100%;
    min-block-size: var(--layout-button-height-medium);
    padding: var(--spacing-12) var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-background-elevated);
    color: var(--color-text-primary);
    cursor: pointer;
    text-align: start;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover:not(:disabled) {
      border-color: var(--color-accent-border);
      background: var(--color-accent-subtle);
    }

    &:focus-visible {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.68;
    }
  }

  .resultAction {
    color: var(--color-accent-primary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .customButton {
    grid-template-columns: auto minmax(0, 1fr) auto;
    border-style: dashed;
  }

  .helperMessage {
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .messageBlock {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
  }

  .errorMessage {
    color: var(--color-danger-primary);
    line-height: var(--line-height-body);
  }

</style>
