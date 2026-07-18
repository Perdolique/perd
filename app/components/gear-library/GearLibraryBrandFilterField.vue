<template>
  <fieldset :class="$style.component" data-filter-field>
    <legend :class="$style.legend">
      <span :class="$style.legendContent">
        <span>Brands</span>

        <span v-if="hasSelectedBrands" :class="$style.selectedCount">
          {{ selectedBrandCountLabel }}
        </span>
      </span>
    </legend>

    <p v-if="isPending" :class="$style.status" role="status">
      Loading brands…
    </p>

    <div v-else-if="isUnavailable" :class="$style.alert" role="alert">
      <span>Brands unavailable.</span>

      <PerdButton size="small" variant="secondary" @click="emit('retry')">
        Retry
      </PerdButton>
    </div>

    <div v-else :class="$style.controls">
      <PerdSearchInput
        v-if="shouldShowSearch"
        v-model="searchValue"
        clear-label="Clear brand search"
        label="Search brands"
        name="brand-search"
        placeholder="Search brands…"
        @keydown.enter.prevent
      />

      <div :id="brandListId" :class="$style.optionList">
        <label
          v-for="brand in visibleBrandViews"
          :key="brand.slug"
          :for="brand.controlId"
          :class="$style.option"
        >
          <input
            :id="brand.controlId"
            :class="$style.choiceControl"
            type="checkbox"
            :checked="brand.isChecked"
            :disabled="brand.isDisabled"
            @change="handleBrandChange(brand.slug, $event)"
          >

          <span :class="$style.optionLabel">{{ brand.name }}</span>
        </label>

        <p v-if="hasNoBrands" :class="$style.status">
          No brands available.
        </p>

        <p v-else-if="hasNoMatchingBrands" :class="$style.status">
          No matching brands.
        </p>
      </div>

      <PerdButton
        v-if="shouldShowToggle"
        :class="$style.toggle"
        size="small"
        variant="ghost"
        :aria-controls="brandListId"
        :aria-expanded="isExpanded"
        @click="isExpanded = !isExpanded"
      >
        {{ toggleLabel }}
      </PerdButton>
    </div>
  </fieldset>
</template>

<script lang="ts" setup>
  import { computed, useId } from 'vue'
  import type { GearLibraryEntitySummary } from '~/types/equipment'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdSearchInput from '~/components/PerdSearchInput.vue'

  interface Props {
    brands: GearLibraryEntitySummary[];
    isLimitReached: boolean;
    isPending: boolean;
    isUnavailable: boolean;
  }

  interface Emits {
    retry: [];
  }

  const initialVisibleBrandCount = 8
  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const selectedBrands = defineModel<string[]>({ required: true })
  const searchValue = defineModel<string>('searchValue', { required: true })
  const isExpanded = defineModel<boolean>('isExpanded', { required: true })
  const componentId = useId()
  const brandListId = `${componentId}-brand-list`
  const nameCollator = new Intl.Collator('en')

  const sortedBrands = computed(() => props.brands.toSorted(
    (left, right) => nameCollator.compare(left.name, right.name)
  ))

  const selectedBrandSlugs = computed(() => new Set(selectedBrands.value))
  const selectedBrandCount = computed(() => selectedBrands.value.length)
  const hasSelectedBrands = computed(() => selectedBrandCount.value > 0)

  const selectedBrandCountLabel = computed(() => {
    const count = selectedBrandCount.value

    return count === 1 ? '1 selected' : `${count} selected`
  })

  const shouldShowSearch = computed(() => sortedBrands.value.length > initialVisibleBrandCount)
  const normalizedSearchValue = computed(() => searchValue.value.trim().toLocaleLowerCase('en'))
  const hasSearchValue = computed(() => shouldShowSearch.value && normalizedSearchValue.value !== '')

  const matchingBrands = computed(() => {
    if (hasSearchValue.value === false) {
      return sortedBrands.value
    }

    return sortedBrands.value.filter((brand) => {
      const normalizedBrandName = brand.name.toLocaleLowerCase('en')

      return normalizedBrandName.includes(normalizedSearchValue.value)
    })
  })

  const collapsedBrands = computed(() => sortedBrands.value.filter((brand, index) => {
    const isInitiallyVisible = index < initialVisibleBrandCount
    const isSelected = selectedBrandSlugs.value.has(brand.slug)

    return isInitiallyVisible || isSelected
  }))

  const visibleBrands = computed(() => {
    if (hasSearchValue.value) {
      return matchingBrands.value
    }

    return isExpanded.value ? sortedBrands.value : collapsedBrands.value
  })

  const visibleBrandViews = computed(() => visibleBrands.value.map((brand) => {
    const isChecked = selectedBrandSlugs.value.has(brand.slug)

    return {
      controlId: `${componentId}-brand-${brand.slug}`,
      isChecked,
      isDisabled: props.isLimitReached && isChecked === false,
      name: brand.name,
      slug: brand.slug
    }
  }))

  const hasNoBrands = computed(() => sortedBrands.value.length === 0)

  const hasNoMatchingBrands = computed(
    () => hasSearchValue.value && visibleBrandViews.value.length === 0
  )

  const shouldShowToggle = computed(() => shouldShowSearch.value && hasSearchValue.value === false)

  const toggleLabel = computed(() => {
    if (isExpanded.value) {
      return 'Show fewer'
    }

    return `Show all ${sortedBrands.value.length} brands`
  })

  function handleBrandChange(brandSlug: string, event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const brandIndex = sortedBrands.value.findIndex((brand) => brand.slug === brandSlug)
    const isAdditionalBrand = brandIndex >= initialVisibleBrandCount

    const shouldExpandBeforeRemoval = input.checked === false
      && isExpanded.value === false
      && isAdditionalBrand

    if (shouldExpandBeforeRemoval) {
      isExpanded.value = true
    }

    // oxlint-disable-next-line unicorn/prefer-ternary -- Explicit selection branches are easier to scan.
    if (input.checked) {
      selectedBrands.value = [...new Set([...selectedBrands.value, brandSlug])]
    } else {
      selectedBrands.value = selectedBrands.value.filter((slug) => slug !== brandSlug)
    }
  }
</script>

<style module>
  .component {
    min-inline-size: 0;
    padding: 0 0 var(--spacing-20);
    border: 0;
    border-block-end: 1px solid var(--color-border-subtle);
  }

  .legend {
    padding: 0;
    margin-block-end: var(--spacing-12);
    color: var(--color-text-primary);
    font-size: var(--font-size-16);
    font-weight: var(--font-weight-semibold);
  }

  .legendContent {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--spacing-8);
  }

  .selectedCount {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-regular);
  }

  .status {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
  }

  .alert {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    padding: var(--spacing-8) var(--spacing-12);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--border-radius-12);
    background: var(--color-danger-subtle);
    color: var(--color-danger-primary);
    font-size: var(--font-size-12);
  }

  .controls {
    display: grid;
    gap: var(--spacing-8);
  }

  .optionList {
    display: grid;
    gap: var(--spacing-4);
  }

  .option {
    display: flex;
    align-items: center;
    gap: var(--spacing-8);
    min-inline-size: 0;
    min-block-size: var(--layout-touch-target);
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-12);
    background-color: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover {
      background-color: var(--color-surface-tertiary);
      color: var(--color-text-primary);
    }

    &:has(.choiceControl:focus-visible) {
      box-shadow: var(--shadow-focus);
    }

    &:has(.choiceControl:checked) {
      background-color: var(--color-accent-subtle);
      color: var(--color-text-primary);

      &:hover {
        background-color: var(--color-accent-subtle-hover);
      }
    }

    &:has(.choiceControl:disabled) {
      cursor: not-allowed;
      opacity: 0.65;

      &:hover {
        background-color: transparent;
        color: var(--color-text-secondary);
      }
    }
  }

  .choiceControl {
    flex: none;
    inline-size: 1.125rem;
    block-size: 1.125rem;
    accent-color: var(--color-accent-primary);

    &:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }

    @media (forced-colors: active) {
      &:focus {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }
    }
  }

  .optionLabel {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  .toggle {
    justify-self: start;
  }
</style>
