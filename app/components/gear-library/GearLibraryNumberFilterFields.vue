<template>
  <fieldset
    v-for="property in propertyViews"
    :key="property.slug"
    :class="$style.component"
    data-filter-field
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
</template>

<script lang="ts" setup>
  import { computed, useId } from 'vue'
  import type { GearLibraryFilterProperty } from '~/types/equipment'

  import type {
    GearLibraryNumberRangeDraft,
    GearLibraryNumberRangeErrors
  } from '~/utils/gear-library-filters'

  interface Props {
    errors: GearLibraryNumberRangeErrors;
    isLimitReached: boolean;
    properties: GearLibraryFilterProperty[];
  }

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

  const props = defineProps<Props>()
  const ranges = defineModel<Record<string, GearLibraryNumberRangeDraft>>({ required: true })
  const componentId = useId()

  /** Reads only an object's own dictionary value. */
  function getOwnRecordValue<Value>(record: Partial<Record<string, Value>>, key: string) {
    return Object.hasOwn(record, key) ? record[key] : undefined
  }

  function getNumberRange(propertySlug: string): GearLibraryNumberRangeDraft {
    return getOwnRecordValue(ranges.value, propertySlug) ?? {
      max: '',
      min: ''
    }
  }

  const propertyViews = computed(() => props.properties
    .filter((property) => property.dataType === 'number')
    .map((property) => {
      const range = getNumberRange(property.slug)
      const errorMessage = getOwnRecordValue(props.errors, property.slug)
      const hasError = errorMessage !== undefined
      const errorId = `${componentId}-error-${property.slug}`
      const hasUnit = property.unit !== null && property.unit !== ''
      const isActive = range.min.trim() !== '' || range.max.trim() !== ''
      const isDisabled = props.isLimitReached && isActive === false

      const sharedFieldState = {
        ariaDescribedby: hasError ? errorId : undefined,
        ariaInvalid: hasError ? true as const : undefined,
        isDisabled
      }

      const fields: NumberFieldView[] = [{
        ...sharedFieldState,
        boundary: 'min',
        controlId: `${componentId}-min-${property.slug}`,
        label: 'Minimum',
        value: range.min
      }, {
        ...sharedFieldState,
        boundary: 'max',
        controlId: `${componentId}-max-${property.slug}`,
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

  function handleNumberChange(
    propertySlug: string,
    boundary: NumberRangeBoundary,
    event: Event
  ) {
    const input = event.currentTarget as HTMLInputElement
    const currentRange = getNumberRange(propertySlug)

    ranges.value = {
      ...ranges.value,
      [propertySlug]: {
        max: boundary === 'max' ? input.value : currentRange.max,
        min: boundary === 'min' ? input.value : currentRange.min
      }
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

  .fieldLabel {
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

    @media (forced-colors: active) {
      &:focus {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }
    }
  }

  .error {
    color: var(--color-danger-primary);
    font-size: var(--font-size-12);

    &:not(:empty) {
      margin-block-start: var(--spacing-8);
    }
  }
</style>
