<template>
  <search :class="$style.component" aria-label="Gear library search">
    <div :class="$style.controls">
      <PerdSearchInput
        v-model="searchValue"
        :class="$style.searchField"
        label="Search gear"
        name="q"
        placeholder="Search by name, brand, or category"
      />

      <div :class="$style.field">
        <label :for="categorySelectId" :class="$style.label">
          Category
        </label>

        <div :class="$style.controlShell">
          <select
            :id="categorySelectId"
            :class="$style.control"
            :value="categoryValue"
            :disabled="isCategoryDisabled"
            :aria-busy="categoriesAriaBusy"
            @change="handleCategoryChange"
          >
            <option value="">
              All categories
            </option>

            <option
              v-for="category in categories"
              :key="category.slug"
              :value="category.slug"
              :disabled="category.isDisabled"
            >
              {{ category.name }}
            </option>
          </select>

          <FidgetSpinner
            v-if="showCategoryIndicator"
            :class="$style.controlSpinner"
            data-testid="gear-library-category-progress"
            aria-hidden="true"
          />
        </div>
      </div>

      <div :class="$style.field">
        <label :for="orderingSelectId" :class="$style.label">
          Sort by
        </label>

        <div :class="$style.controlShell">
          <select
            :id="orderingSelectId"
            :class="$style.control"
            :value="orderingValue"
            :disabled="isOrderingDisabled"
            :aria-busy="orderingAriaBusy"
            @change="handleOrderingChange"
          >
            <option
              v-for="option in orderingOptions"
              :key="option.value"
              :value="option.value"
              :disabled="option.isDisabled"
            >
              {{ option.label }}
            </option>
          </select>

          <FidgetSpinner
            v-if="showOrderingIndicator"
            :class="$style.controlSpinner"
            data-testid="gear-library-sort-progress"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>

    <div
      v-if="hasCategoriesUnavailable"
      :class="$style.alert"
      role="alert"
    >
      <span>Categories unavailable.</span>

      <PerdButton size="small" variant="secondary" @click="emit('retry-categories')">
        Retry
      </PerdButton>
    </div>

    <div
      v-if="hasCategoryDetailUnavailable"
      :class="$style.alert"
      role="alert"
    >
      <span>Category filters and property sorting unavailable.</span>

      <PerdButton size="small" variant="secondary" @click="emit('retry-category-detail')">
        Retry
      </PerdButton>
    </div>
  </search>
</template>

<script lang="ts" setup>
  import { computed, useId } from 'vue'
  import type { GearLibraryEntitySummary } from '~/types/equipment'
  import type { GearLibraryOrdering } from '~/utils/gear-library'
  import { useDelayedPendingIndicator } from '~/composables/use-delayed-pending-indicator'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdSearchInput from '~/components/PerdSearchInput.vue'

  interface GearLibraryCategoryOption extends GearLibraryEntitySummary {
    isDisabled?: boolean;
  }

  interface GearLibraryOrderingOption extends GearLibraryOrdering {
    isDisabled?: boolean;
    label: string;
    value: string;
  }

  interface Props {
    categories: GearLibraryCategoryOption[];
    categoryValue: string;
    hasCategoriesUnavailable: boolean;
    hasCategoryDetailUnavailable: boolean;
    isCategoryDisabled: boolean;
    isCategoryPending: boolean;
    isOrderingDisabled: boolean;
    isOrderingPending: boolean;
    orderingOptions: GearLibraryOrderingOption[];
    orderingValue: string;
  }

  interface Emits {
    (event: 'category-change', value: string): void;
    (event: 'ordering-change', value: GearLibraryOrdering): void;
    (event: 'retry-categories' | 'retry-category-detail'): void;
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchValue = defineModel<string>('searchValue', {
    required: true
  })

  const categorySelectId = useId()
  const orderingSelectId = useId()
  const categoryPending = computed(() => props.isCategoryPending)
  const orderingPending = computed(() => props.isOrderingPending)
  const categoriesAriaBusy = computed(() => props.isCategoryPending || undefined)
  const orderingAriaBusy = computed(() => props.isOrderingPending || undefined)

  const showCategoryIndicator = useDelayedPendingIndicator(categoryPending, {
    delayMs: 300,
    minimumVisibleMs: 180
  })

  const showOrderingIndicator = useDelayedPendingIndicator(orderingPending, {
    delayMs: 300,
    minimumVisibleMs: 180
  })

  function handleCategoryChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement

    emit('category-change', select.value)
  }

  function handleOrderingChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement
    const selectedOption = props.orderingOptions.find((option) => option.value === select.value)

    if (selectedOption === undefined) {
      return
    }

    const ordering = {
      direction: selectedOption.direction,
      sort: selectedOption.sort
    }

    emit('ordering-change', ordering)
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-16);
    container-type: inline-size;
  }

  .controls {
    display: grid;
    gap: var(--spacing-12);

    @container (inline-size >= 36rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @container (inline-size >= 44rem) {
      grid-template-columns: minmax(14rem, 2fr) repeat(2, minmax(10rem, 1fr));
      align-items: start;
    }
  }

  .searchField {
    @container (36rem <= inline-size < 44rem) {
      grid-column: 1 / -1;
    }
  }

  /* Grid items and native controls otherwise keep intrinsic minimum widths and can overflow their tracks. */
  .field,
  .control,
  .controlShell {
    min-inline-size: 0;
  }

  .field {
    display: grid;
    align-content: start;
    gap: var(--spacing-8);
  }

  .label {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .control {
    inline-size: 100%;
    min-block-size: var(--layout-button-height-medium);
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--layout-button-radius-small);
    background-color: var(--color-background-elevated);
    color: var(--color-text-primary);
    line-height: var(--line-height-snug);
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover:not(:disabled) {
      border-color: var(--color-accent-primary);
    }

    &:focus-visible {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
      outline: none;
    }

    &:disabled {
      cursor: not-allowed;
      border-color: var(--color-border-subtle);
      background-color: var(--color-surface-secondary);
      color: var(--color-text-muted);
    }
  }

  .controlShell {
    position: relative;

    .control {
      padding-inline-end: var(--spacing-48);
    }
  }

  .controlSpinner {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-end: var(--spacing-32);
    color: var(--color-text-muted);
    font-size: var(--font-size-16);
    pointer-events: none;
    translate: 0 -50%;
  }

  .alert {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    padding: var(--spacing-12);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--border-radius-12);
    background-color: var(--color-danger-subtle);
    color: var(--color-danger-primary);
    font-size: var(--font-size-14);
  }

  @media (forced-colors: active) {
    .control:focus {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
