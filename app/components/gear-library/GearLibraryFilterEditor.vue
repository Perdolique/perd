<template>
  <form
    :class="$style.component"
    :aria-labelledby="titleId"
    @submit.prevent="emit('apply')"
  >
    <div :class="$style.header">
      <div :class="$style.titleBlock">
        <h2
          :id="titleId"
          :class="$style.title"
          autofocus
          tabindex="-1"
        >
          Filters
        </h2>

        <div :class="$style.filterSummary">
          <PerdPill
            v-if="filterLimitMessage"
            :role="filterLimitRole"
            :tone="filterLimitTone"
          >
            {{ filterLimitMessage }}
          </PerdPill>

          <span v-else :class="$style.draftCount">
            {{ draftFilterCountLabel }}
          </span>
        </div>
      </div>

      <PerdIconButton
        :class="$style.closeButton"
        icon="hugeicons:cancel-01"
        label="Close filters"
        @click="emit('cancel')"
      />
    </div>

    <div :class="$style.fields">
      <fieldset :class="$style.fieldset">
        <legend :class="$style.legend">
          <span :class="$style.legendContent">
            <span>Brands</span>

            <span v-if="hasSelectedBrands" :class="$style.selectedCount">
              {{ selectedBrandCountLabel }}
            </span>
          </span>
        </legend>

        <p v-if="isBrandsPending" :class="$style.status" role="status">
          Loading brands…
        </p>

        <div v-else-if="hasBrandsUnavailable" :class="$style.alert" role="alert">
          <span>Brands unavailable.</span>

          <PerdButton size="small" variant="secondary" @click="emit('retry-brands')">
            Retry
          </PerdButton>
        </div>

        <div v-else :class="$style.brandControls">
          <PerdSearchInput
            v-if="shouldShowBrandSearch"
            v-model="brandSearchValue"
            clear-label="Clear brand search"
            label="Search brands"
            name="brand-search"
            placeholder="Search brands…"
            @keydown.enter.prevent
          />

          <div :id="brandListId" :class="$style.optionList">
            <label
              v-for="brand in visibleBrands"
              :key="brand.slug"
              :for="getControlId('brand', brand.slug)"
              :class="$style.option"
            >
              <input
                :id="getControlId('brand', brand.slug)"
                :class="$style.choiceControl"
                type="checkbox"
                :checked="draftFilters.brand.includes(brand.slug)"
                :disabled="isBrandOptionDisabled(brand.slug)"
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
            v-if="shouldShowBrandToggle"
            :class="$style.brandToggle"
            size="small"
            variant="ghost"
            :aria-controls="brandListId"
            :aria-expanded="isBrandListExpanded"
            @click="handleBrandToggle"
          >
            {{ brandToggleLabel }}
          </PerdButton>
        </div>
      </fieldset>

      <template v-if="hasSelectedCategory">
        <p v-if="isPropertiesPending" :class="$style.status" role="status">
          Loading category filters…
        </p>

        <div v-else-if="hasPropertiesUnavailable" :class="$style.alert" role="alert">
          <span>Category filters unavailable.</span>

          <PerdButton size="small" variant="secondary" @click="emit('retry-properties')">
            Retry
          </PerdButton>
        </div>

        <template v-else>
          <fieldset
            v-for="property in numberPropertyViews"
            :key="property.slug"
            :class="$style.fieldset"
          >
            <legend :class="$style.legend">
              {{ property.label }}
            </legend>

            <div :class="$style.range">
              <label
                v-for="field in property.fields"
                :key="field.boundary"
                :for="field.controlId"
                :class="$style.rangeField"
              >
                <span :class="$style.fieldLabel">{{ field.label }}</span>

                <input
                  :id="field.controlId"
                  :class="$style.numberInput"
                  :value="field.value"
                  :aria-describedby="field.ariaDescribedby"
                  :aria-invalid="field.ariaInvalid"
                  :disabled="field.isDisabled"
                  inputmode="decimal"
                  step="any"
                  type="number"
                  @input="handleNumberChange(property.slug, field.boundary, $event)"
                >
              </label>
            </div>

            <p
              :id="property.errorId"
              :class="$style.error"
              aria-live="polite"
              aria-atomic="true"
            >
              {{ property.errorMessage }}
            </p>
          </fieldset>

          <fieldset
            v-for="property in enumPropertyViews"
            :key="property.slug"
            :class="$style.fieldset"
          >
            <legend :class="$style.legend">
              {{ property.name }}
            </legend>

            <div :class="$style.optionList">
              <label
                v-for="option in property.options"
                :key="option.slug"
                :for="option.controlId"
                :class="$style.option"
              >
                <input
                  :id="option.controlId"
                  :class="$style.choiceControl"
                  type="checkbox"
                  :checked="option.isChecked"
                  :disabled="option.isDisabled"
                  @change="handleEnumChange(property.slug, option.slug, $event)"
                >

                <span :class="$style.optionLabel">{{ option.name }}</span>
              </label>
            </div>
          </fieldset>

          <fieldset
            v-for="property in booleanProperties"
            :key="property.slug"
            :class="$style.fieldset"
          >
            <legend :class="$style.legend">
              {{ property.name }}
            </legend>

            <div :class="$style.booleanOptionList">
              <label
                v-for="option in booleanOptions"
                :key="option.value"
                :for="getControlId(property.slug, option.value)"
                :class="$style.option"
              >
                <input
                  :id="getControlId(property.slug, option.value)"
                  :class="$style.choiceControl"
                  type="radio"
                  :name="getControlId('boolean', property.slug)"
                  :value="option.value"
                  :checked="getSelectedBooleanValue(property.slug) === option.value"
                  :disabled="isBooleanOptionDisabled(property.slug, option.value)"
                  @change="handleBooleanChange(property.slug, option.value)"
                >

                <span :class="$style.optionLabel">{{ option.label }}</span>
              </label>
            </div>
          </fieldset>
        </template>
      </template>
    </div>

    <div :class="$style.actions">
      <PerdButton
        block
        type="submit"
        :disabled="isApplyDisabled"
      >
        Apply filters
      </PerdButton>

      <PerdButton
        block
        variant="secondary"
        :disabled="isClearDisabled"
        @click="emit('clear')"
      >
        Clear filters
      </PerdButton>
    </div>
  </form>
</template>

<script lang="ts" setup>
  // oxlint-disable max-lines
  import { computed, useId } from 'vue'
  import { limits } from '#shared/constants'
  import type {
    EquipmentPropertyDataType,
    GearLibraryEntitySummary
  } from '~/types/equipment'
  import {
    normalizeGearLibraryFilterDraft,
    type GearLibraryBooleanDraftValue,
    type GearLibraryFilterDraft,
    type GearLibraryNumberRangeDraft,
    type GearLibraryNumberRangeErrors
  } from '~/utils/gear-library-filters'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdIconButton from '~/components/PerdIconButton.vue'
  import PerdPill from '~/components/PerdPill.vue'
  import PerdSearchInput from '~/components/PerdSearchInput.vue'

  interface GearLibraryFilterProperty extends GearLibraryEntitySummary {
    dataType: EquipmentPropertyDataType;
    enumOptions?: GearLibraryEntitySummary[];
    unit: string | null;
  }

  interface Props {
    brands: GearLibraryEntitySummary[];
    draftFilterCount: number;
    hasBrandsUnavailable: boolean;
    hasDraftChanges: boolean;
    hasDraftFilters: boolean;
    hasNumberRangeErrors: boolean;
    hasPropertiesUnavailable: boolean;
    hasSelectedCategory: boolean;
    isBrandsPending: boolean;
    isPropertiesPending: boolean;
    numberRangeErrors: GearLibraryNumberRangeErrors;
    properties: GearLibraryFilterProperty[];
    titleId: string;
  }

  type Emits = (
    event: 'apply'
      | 'cancel'
      | 'clear'
      | 'retry-brands'
      | 'retry-properties'
  ) => void

  type NumberRangeBoundary = keyof GearLibraryNumberRangeDraft

  interface NumberFieldView {
    ariaDescribedby: string | undefined;
    ariaInvalid: true | undefined;
    boundary: NumberRangeBoundary;
    controlId: string;
    isDisabled: boolean;
    label: string;
    value: string;
  }

  const initialVisibleBrandCount = 8

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const draftFilters = defineModel<GearLibraryFilterDraft>({ required: true })
  const brandSearchValue = defineModel<string>('brandSearchValue', { required: true })
  const isBrandListExpanded = defineModel<boolean>('isBrandListExpanded', { required: true })
  const componentId = useId()
  const brandListId = `${componentId}-brand-list`
  const nameCollator = new Intl.Collator('en')
  const maximumFilterCount = limits.maxEquipmentItemsFilterCount

  const booleanOptions: { label: string; value: GearLibraryBooleanDraftValue }[] = [{
    label: 'Any',
    value: 'any'
  }, {
    label: 'Yes',
    value: 'true'
  }, {
    label: 'No',
    value: 'false'
  }]

  const filterLimitState = computed(() => {
    const filters = normalizeGearLibraryFilterDraft(draftFilters.value)
    const brandFilterCount = filters.brand.length
    const propertyFilterCount = filters.boolean.length + filters.enum.length + filters.number.length
    const hasBrandFilterLimitError = brandFilterCount > maximumFilterCount
    const hasPropertyFilterLimitError = propertyFilterCount > maximumFilterCount
    const hasFilterLimitErrors = hasBrandFilterLimitError || hasPropertyFilterLimitError
    const isBrandFilterLimitReached = brandFilterCount >= maximumFilterCount
    const isPropertyFilterLimitReached = propertyFilterCount >= maximumFilterCount

    return {
      hasBrandFilterLimitError, hasFilterLimitErrors, hasPropertyFilterLimitError,
      isBrandFilterLimitReached, isPropertyFilterLimitReached
    }
  })
  const filterLimitMessage = computed(() => {
    const state = filterLimitState.value

    if (state.hasBrandFilterLimitError && state.hasPropertyFilterLimitError) {
      return `Select no more than ${maximumFilterCount} brands and ${maximumFilterCount} property filters.`
    }

    if (state.hasBrandFilterLimitError) {
      return `Select no more than ${maximumFilterCount} brands.`
    }
    if (state.hasPropertyFilterLimitError) {
      return `Select no more than ${maximumFilterCount} property filters.`
    }
    if (state.isBrandFilterLimitReached && state.isPropertyFilterLimitReached) {
      return 'Brand and property filter limits reached.'
    }
    if (state.isBrandFilterLimitReached) {
      return `Limit of ${maximumFilterCount} brands reached. Deselect one to choose another.`
    }
    if (state.isPropertyFilterLimitReached) {
      return `Limit of ${maximumFilterCount} property filters reached. Remove one to add another.`
    }

    return null
  })
  const filterLimitRole = computed(() => filterLimitState.value.hasFilterLimitErrors ? 'alert' : 'status')
  const filterLimitTone = computed(() => filterLimitState.value.hasFilterLimitErrors ? 'danger' : 'warning')
  const isApplyDisabled = computed(() => filterLimitState.value.hasFilterLimitErrors
    || props.hasNumberRangeErrors || props.hasDraftChanges === false)
  const isClearDisabled = computed(() => props.hasDraftFilters === false && props.hasDraftChanges === false)
  const draftFilterCountLabel = computed(() => {
    const count = props.draftFilterCount

    return count === 1 ? '1 filter selected' : `${count} filters selected`
  })

  const sortedBrands = computed(() => props.brands.toSorted(
    (left, right) => nameCollator.compare(left.name, right.name)
  ))

  const selectedBrandSlugs = computed(() => new Set(draftFilters.value.brand))
  const selectedBrandCount = computed(() => draftFilters.value.brand.length)
  const hasSelectedBrands = computed(() => selectedBrandCount.value > 0)
  const selectedBrandCountLabel = computed(() => {
    const count = selectedBrandCount.value

    return count === 1 ? '1 selected' : `${count} selected`
  })

  const shouldShowBrandSearch = computed(() => sortedBrands.value.length > initialVisibleBrandCount)

  const normalizedBrandSearchValue = computed(
    () => brandSearchValue.value.trim().toLocaleLowerCase('en')
  )

  const hasBrandSearchValue = computed(
    () => shouldShowBrandSearch.value && normalizedBrandSearchValue.value !== ''
  )

  const matchingBrands = computed(() => {
    if (hasBrandSearchValue.value === false) {
      return sortedBrands.value
    }

    const searchValue = normalizedBrandSearchValue.value

    return sortedBrands.value.filter((brand) => {
      const normalizedBrandName = brand.name.toLocaleLowerCase('en')

      return normalizedBrandName.includes(searchValue)
    })
  })

  const collapsedBrands = computed(() => sortedBrands.value.filter((brand, index) => {
    const isInitiallyVisible = index < initialVisibleBrandCount
    const isSelected = selectedBrandSlugs.value.has(brand.slug)

    return isInitiallyVisible || isSelected
  }))

  const visibleBrands = computed(() => {
    if (hasBrandSearchValue.value) {
      return matchingBrands.value
    }

    return isBrandListExpanded.value ? sortedBrands.value : collapsedBrands.value
  })

  const hasNoBrands = computed(() => sortedBrands.value.length === 0)
  const hasNoMatchingBrands = computed(
    () => hasBrandSearchValue.value && visibleBrands.value.length === 0
  )

  const shouldShowBrandToggle = computed(
    () => shouldShowBrandSearch.value && hasBrandSearchValue.value === false
  )

  const brandToggleLabel = computed(() => {
    if (isBrandListExpanded.value) {
      return 'Show fewer'
    }

    return `Show all ${sortedBrands.value.length} brands`
  })

  function getControlId(group: string, value: string) {
    return `${componentId}-${group}-${value}`
  }

  function getOwnRecordValue<Value>(record: Partial<Record<string, Value>>, key: string) {
    return Object.hasOwn(record, key) ? record[key] : undefined
  }

  function getNumberRange(propertySlug: string): GearLibraryNumberRangeDraft {
    const range = getOwnRecordValue(draftFilters.value.number, propertySlug)

    return range ?? {
      max: '',
      min: ''
    }
  }

  function getSelectedEnumOptions(propertySlug: string) {
    return getOwnRecordValue(draftFilters.value.enum, propertySlug) ?? []
  }

  const numberPropertyViews = computed(() => props.properties
    .filter((property) => property.dataType === 'number')
    .map((property) => {
      const range = getNumberRange(property.slug)
      const errorMessage = getOwnRecordValue(props.numberRangeErrors, property.slug)
      const hasError = errorMessage !== undefined
      const errorId = getControlId('error', property.slug)
      const hasUnit = property.unit !== null && property.unit !== ''
      const isActive = range.min.trim() !== '' || range.max.trim() !== ''
      const isDisabled = filterLimitState.value.isPropertyFilterLimitReached
        && isActive === false
      const sharedFieldState = {
        ariaDescribedby: hasError ? errorId : undefined,
        ariaInvalid: hasError ? true as const : undefined,
        isDisabled
      }
      const fields: NumberFieldView[] = [{
        ...sharedFieldState,
        boundary: 'min',
        controlId: getControlId('min', property.slug),
        label: 'Minimum',
        value: range.min
      }, {
        ...sharedFieldState,
        boundary: 'max',
        controlId: getControlId('max', property.slug),
        label: 'Maximum',
        value: range.max
      }]

      return {
        errorId,
        errorMessage: errorMessage ?? '',
        fields,
        label: hasUnit ? `${property.name} (${property.unit})` : property.name,
        slug: property.slug
      }
    }))

  const enumPropertyViews = computed(() => props.properties
    .filter((property) => property.dataType === 'enum')
    .map((property) => {
      const selectedOptions = new Set(getSelectedEnumOptions(property.slug))
      const options = (property.enumOptions ?? [])
        .toSorted((left, right) => nameCollator.compare(left.name, right.name))
        .map((option) => {
          const isChecked = selectedOptions.has(option.slug)

          return {
            controlId: getControlId(property.slug, option.slug),
            isChecked,
            isDisabled: filterLimitState.value.isPropertyFilterLimitReached
              && isChecked === false,
            name: option.name,
            slug: option.slug
          }
        })

      return {
        name: property.name,
        options,
        slug: property.slug
      }
    }))

  const booleanProperties = computed(() => props.properties.filter(
    (property) => property.dataType === 'boolean'
  ))

  function getSelectedBooleanValue(propertySlug: string): GearLibraryBooleanDraftValue {
    return getOwnRecordValue(draftFilters.value.boolean, propertySlug) ?? 'any'
  }

  function isBrandOptionDisabled(brandSlug: string) {
    const isSelected = selectedBrandSlugs.value.has(brandSlug)

    return filterLimitState.value.isBrandFilterLimitReached && isSelected === false
  }

  function isBooleanOptionDisabled(
    propertySlug: string,
    value: GearLibraryBooleanDraftValue
  ) {
    const selectedValue = getSelectedBooleanValue(propertySlug)
    const isPropertyActive = selectedValue !== 'any'
    const addsPropertyFilter = isPropertyActive === false && value !== 'any'

    return filterLimitState.value.isPropertyFilterLimitReached && addsPropertyFilter
  }

  function getChecked(event: Event) {
    const input = event.currentTarget as HTMLInputElement

    return input.checked
  }

  function handleBrandChange(brandSlug: string, event: Event) {
    const isChecked = getChecked(event)
    const brandIndex = sortedBrands.value.findIndex((brand) => brand.slug === brandSlug)
    const isAdditionalBrand = brandIndex >= initialVisibleBrandCount
    const shouldExpandBeforeRemoval = isChecked === false
      && isBrandListExpanded.value === false
      && isAdditionalBrand

    if (shouldExpandBeforeRemoval) {
      isBrandListExpanded.value = true
    }

    const nextBrands = isChecked
      ? [...new Set([...draftFilters.value.brand, brandSlug])]
      : draftFilters.value.brand.filter((slug) => slug !== brandSlug)

    draftFilters.value = {
      boolean: draftFilters.value.boolean,
      brand: nextBrands,
      enum: draftFilters.value.enum,
      number: draftFilters.value.number
    }
  }

  function handleBrandToggle() {
    isBrandListExpanded.value = !isBrandListExpanded.value
  }

  function handleNumberChange(
    propertySlug: string,
    boundary: NumberRangeBoundary,
    event: Event
  ) {
    const input = event.currentTarget as HTMLInputElement
    const currentRange = getNumberRange(propertySlug)
    const nextRange = {
      max: boundary === 'max' ? input.value : currentRange.max,
      min: boundary === 'min' ? input.value : currentRange.min
    }

    draftFilters.value = {
      boolean: draftFilters.value.boolean,
      brand: draftFilters.value.brand,
      enum: draftFilters.value.enum,
      number: {
        ...draftFilters.value.number,
        [propertySlug]: nextRange
      }
    }
  }

  function handleEnumChange(propertySlug: string, optionSlug: string, event: Event) {
    const isChecked = getChecked(event)
    const currentOptions = getSelectedEnumOptions(propertySlug)
    const nextOptions = isChecked
      ? [...new Set([...currentOptions, optionSlug])]
      : currentOptions.filter((slug) => slug !== optionSlug)

    draftFilters.value = {
      boolean: draftFilters.value.boolean,
      brand: draftFilters.value.brand,
      enum: {
        ...draftFilters.value.enum,
        [propertySlug]: nextOptions
      },
      number: draftFilters.value.number
    }
  }

  function handleBooleanChange(propertySlug: string, value: GearLibraryBooleanDraftValue) {
    draftFilters.value = {
      boolean: {
        ...draftFilters.value.boolean,
        [propertySlug]: value
      },
      brand: draftFilters.value.brand,
      enum: draftFilters.value.enum,
      number: draftFilters.value.number
    }
  }
</script>

<style module>
  .component {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-block-size: 100%;
    border-radius: inherit;
    background-color: var(--color-surface-primary);
  }

  .header {
    position: sticky;
    z-index: 2;
    inset-block-start: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    padding: var(--spacing-16) var(--spacing-20);
    border-block-end: 1px solid var(--color-border-subtle);
    border-start-start-radius: inherit;
    border-start-end-radius: inherit;
    background-color: var(--color-surface-primary);
  }

  .titleBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .closeButton {
    flex: none;
    inline-size: var(--layout-touch-target);
    block-size: var(--layout-touch-target);
    border-radius: var(--border-radius-12);
  }

  .title {
    font-size: var(--font-size-20);
  }

  .draftCount,
  .selectedCount {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-regular);
  }

  .filterSummary {
    display: flex;
    align-items: center;
    block-size: 2.75rem;
  }

  .fields {
    display: grid;
    align-content: start;
    gap: var(--spacing-20);
    padding: var(--spacing-20);
  }

  .fieldset {
    min-inline-size: 0;
    padding: 0 0 var(--spacing-20);
    border: 0;
    border-block-end: 1px solid var(--color-border-subtle);

    &:last-child {
      padding-block-end: 0;
      border-block-end: 0;
    }
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

  .brandControls {
    display: grid;
    gap: var(--spacing-8);
  }

  .brandToggle {
    justify-self: start;
  }

  .optionList {
    display: grid;
    gap: var(--spacing-4);
  }

  .booleanOptionList {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .optionLabel {
    min-inline-size: 0;
    overflow-wrap: anywhere;
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
  }

  .range {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: var(--spacing-12);
  }

  .rangeField {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .fieldLabel,
  .status {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
  }

  .numberInput {
    min-inline-size: 0;
    inline-size: 100%;
    min-block-size: var(--layout-touch-target);
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background-color: var(--color-background-elevated);
    color: var(--color-text-primary);

    &:focus-visible {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }

    &[aria-invalid="true"] {
      border-color: var(--color-danger-primary);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }
  }

  .error {
    color: var(--color-danger-primary);
    font-size: var(--font-size-12);

    &:not(:empty) {
      margin-block-start: var(--spacing-8);
    }
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

  .actions {
    position: sticky;
    z-index: 2;
    inset-block-end: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-12);
    padding: var(--spacing-16) var(--spacing-20);
    border-end-start-radius: inherit;
    border-end-end-radius: inherit;
    background-color: var(--color-surface-primary);
  }

  @media (forced-colors: active) {
    .choiceControl:focus,
    .numberInput:focus {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
