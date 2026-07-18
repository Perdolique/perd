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

      <PerdSelect
        v-model="categorySelectValue"
        label="Category"
        :options="categorySelectOptions"
        :disabled="isCategoryDisabled"
        :pending="isCategoryPending"
      />

      <PerdSelect
        v-model="orderingSelectValue"
        label="Sort by"
        :options="orderingSelectOptions"
        :disabled="isOrderingDisabled"
        :pending="isOrderingPending"
      />
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
  import { computed } from 'vue'
  import type { GearLibraryEntitySummary } from '~/types/equipment'
  import type { GearLibraryOrdering } from '~/utils/gear-library'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdSearchInput from '~/components/PerdSearchInput.vue'
  import PerdSelect, { type PerdSelectOption } from '~/components/perd-select/PerdSelect.vue'

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

  const categorySelectOptions = computed<PerdSelectOption[]>(() => {
    const categoryOptions = props.categories.map((category) => {
      return {
        disabled: category.isDisabled,
        label: category.name,
        value: category.slug
      }
    })

    return [{
      label: 'All categories',
      value: ''
    }, ...categoryOptions]
  })

  const orderingSelectOptions = computed<PerdSelectOption[]>(() => (
    props.orderingOptions.map((option) => {
      return {
        disabled: option.isDisabled,
        label: option.label,
        value: option.value
      }
    })
  ))

  const categorySelectValue = computed({
    get: () => props.categoryValue,
    set: (value: string) => emit('category-change', value)
  })

  function handleOrderingChange(value: string) {
    const selectedOption = props.orderingOptions.find((option) => option.value === value)

    if (selectedOption === undefined) {
      return
    }

    const ordering = {
      direction: selectedOption.direction,
      sort: selectedOption.sort
    }

    emit('ordering-change', ordering)
  }

  const orderingSelectValue = computed({
    get: () => props.orderingValue,
    set: handleOrderingChange
  })
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
