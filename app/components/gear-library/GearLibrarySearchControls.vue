<template>
  <search :class="$style.component" aria-label="Gear library search">
    <div :class="$style.controls">
      <PerdSearchInput
        v-model="searchValue"
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
            :disabled="isCategoryPending"
            :aria-busy="categoriesAriaBusy"
            @change="handleCategoryChange"
          >
            <option value="">
              All categories
            </option>

            <option
              v-if="showSelectedCategoryFallback"
              :value="categoryValue"
            >
              {{ selectedCategoryFallbackLabel }}
            </option>

            <option
              v-for="category in categories"
              :key="category.slug"
              :value="category.slug"
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
        <label :for="sortSelectId" :class="$style.label">
          Sort by
        </label>

        <div :class="$style.controlShell">
          <select
            :id="sortSelectId"
            :class="$style.control"
            :value="sortValue"
            :disabled="isSortPending"
            :aria-busy="categoryDetailAriaBusy"
            @change="handleSortChange"
          >
            <option
              v-if="showSelectedSortFallback"
              :value="sortValue"
            >
              {{ selectedSortFallbackLabel }}
            </option>

            <option
              v-for="option in sortOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>

          <FidgetSpinner
            v-if="showSortIndicator"
            :class="$style.controlSpinner"
            data-testid="gear-library-sort-progress"
            aria-hidden="true"
          />
        </div>
      </div>

      <div :class="$style.field">
        <label :for="directionSelectId" :class="$style.label">
          Direction
        </label>

        <select
          :id="directionSelectId"
          :class="$style.control"
          :value="directionValue"
          @change="handleDirectionChange"
        >
          <option value="asc">
            Ascending
          </option>

          <option value="desc">
            Descending
          </option>
        </select>
      </div>
    </div>

    <div
      v-if="hasCategoriesError"
      :class="$style.alert"
      role="alert"
    >
      <span>Categories unavailable.</span>

      <PerdButton size="small" variant="secondary" @click="emitRetryCategories">
        Retry
      </PerdButton>
    </div>

    <div
      v-if="hasCategoryDetailError"
      :class="$style.alert"
      role="alert"
    >
      <span>Property sorting unavailable.</span>

      <PerdButton size="small" variant="secondary" @click="emitRetryCategoryDetail">
        Retry
      </PerdButton>
    </div>
  </search>
</template>

<script lang="ts" setup>
  import { computed, useId } from 'vue'
  import type { GearLibraryEntitySummary } from '~/types/equipment'
  import type { GearLibraryDirection, GearLibrarySort } from '~/utils/gear-library'
  import { useDelayedPendingIndicator } from '~/composables/use-delayed-pending-indicator'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdSearchInput from '~/components/PerdSearchInput.vue'

  interface GearLibrarySortOption {
    label: string;
    value: GearLibrarySort;
  }

  interface Props {
    categories: GearLibraryEntitySummary[];
    categoryValue: string;
    directionValue: GearLibraryDirection;
    hasCategoriesError: boolean;
    hasCategoryDetailError: boolean;
    isCategoryPending: boolean;
    isSortPending: boolean;
    sortOptions: GearLibrarySortOption[];
    sortValue: GearLibrarySort;
  }

  interface Emits {
    (event: 'category-change', value: string): void;
    (event: 'direction-change', value: GearLibraryDirection): void;
    (event: 'retry-categories' | 'retry-category-detail'): void;
    (event: 'sort-change', value: GearLibrarySort): void;
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchValue = defineModel<string>('searchValue', {
    required: true
  })

  const categorySelectId = useId()
  const sortSelectId = useId()
  const directionSelectId = useId()

  const categoryPending = computed(() => props.isCategoryPending)
  const sortPending = computed(() => props.isSortPending)
  const categoriesAriaBusy = computed(() => props.isCategoryPending || undefined)
  const categoryDetailAriaBusy = computed(() => props.isSortPending || undefined)

  const showCategoryIndicator = useDelayedPendingIndicator(categoryPending, {
    delayMs: 300,
    minimumVisibleMs: 180
  })

  const showSortIndicator = useDelayedPendingIndicator(sortPending, {
    delayMs: 300,
    minimumVisibleMs: 180
  })

  const showSelectedCategoryFallback = computed(() => {
    if (props.categoryValue === '') {
      return false
    }

    const hasSelectedCategory = props.categories.some((category) => category.slug === props.categoryValue)

    return hasSelectedCategory === false
  })

  const selectedCategoryFallbackLabel = computed(() => props.categoryValue)

  const showSelectedSortFallback = computed(() => {
    const hasSelectedSort = props.sortOptions.some((option) => option.value === props.sortValue)

    return hasSelectedSort === false
  })

  const selectedSortFallbackLabel = computed(() => {
    if (props.sortValue === 'name') {
      return 'Name'
    }

    if (props.sortValue === 'brand') {
      return 'Brand'
    }

    const propertySlug = props.sortValue.slice('property:'.length)

    return `Property: ${propertySlug}`
  })

  function handleCategoryChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement

    emit('category-change', select.value)
  }

  function handleDirectionChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement
    const direction = select.value as GearLibraryDirection

    emit('direction-change', direction)
  }

  function handleSortChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement
    const sort = select.value as GearLibrarySort

    emit('sort-change', sort)
  }

  function emitRetryCategories() {
    emit('retry-categories')
  }

  function emitRetryCategoryDetail() {
    emit('retry-category-detail')
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-16);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-24);
    background-color: var(--color-surface-primary);
    container-type: inline-size;
  }

  .controls {
    display: grid;
    gap: var(--spacing-12);

    @container (inline-size >= 52rem) {
      grid-template-columns: minmax(14rem, 2fr) repeat(3, minmax(9rem, 1fr));
      align-items: start;
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
    font: inherit;
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
    translate: 0 -50%;
  }

  .controlSpinner {
    inset-inline-end: var(--spacing-32);
    color: var(--color-text-muted);
    font-size: var(--font-size-16);
    pointer-events: none;
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
</style>
