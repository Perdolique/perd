<template>
  <fieldset
    v-for="property in propertyViews"
    :key="property.slug"
    :class="$style.component"
    data-filter-field
  >
    <legend :class="$style.legend">
      {{ property.name }}
    </legend>

    <div :class="$style.optionList">
      <label
        v-for="option in property.options"
        :key="option.value"
        :for="option.controlId"
        :class="$style.option"
      >
        <input
          :id="option.controlId"
          :class="$style.choiceControl"
          type="radio"
          :name="property.controlName"
          :value="option.value"
          :checked="option.isChecked"
          :disabled="option.isDisabled"
          @change="handleOptionChange(property.slug, option.value)"
        >

        <span :class="$style.optionLabel">{{ option.label }}</span>
      </label>
    </div>
  </fieldset>
</template>

<script lang="ts" setup>
  import { computed, useId } from 'vue'
  import type { GearLibraryFilterProperty } from '~/types/equipment'
  import type { GearLibraryBooleanDraftValue } from '~/utils/gear-library-filters'

  interface Props {
    isLimitReached: boolean;
    properties: GearLibraryFilterProperty[];
  }

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

  const props = defineProps<Props>()
  const componentId = useId()

  const selectedValues = defineModel<Record<string, GearLibraryBooleanDraftValue>>({
    required: true
  })


  /** Reads a boolean draft value without consulting inherited dictionary properties. */
  function getSelectedValue(propertySlug: string): GearLibraryBooleanDraftValue {
    return Object.hasOwn(selectedValues.value, propertySlug)
      ? selectedValues.value[propertySlug] ?? 'any'
      : 'any'
  }

  const propertyViews = computed(() => props.properties
    .filter((property) => property.dataType === 'boolean')
    .map((property) => {
      const selectedValue = getSelectedValue(property.slug)
      const isPropertyActive = selectedValue !== 'any'

      const options = booleanOptions.map((option) => {
        const addsPropertyFilter = isPropertyActive === false && option.value !== 'any'

        return {
          controlId: `${componentId}-${property.slug}-${option.value}`,
          isChecked: selectedValue === option.value,
          isDisabled: props.isLimitReached && addsPropertyFilter,
          label: option.label,
          value: option.value
        }
      })

      return {
        options,
        controlName: `${componentId}-boolean-${property.slug}`,
        name: property.name,
        slug: property.slug
      }
    }))

  function handleOptionChange(propertySlug: string, value: GearLibraryBooleanDraftValue) {
    selectedValues.value = {
      ...selectedValues.value,
      [propertySlug]: value
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

  .optionList {
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
</style>
