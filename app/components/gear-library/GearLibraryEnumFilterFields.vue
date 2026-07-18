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
          @change="handleOptionChange(property.slug, option.slug, $event)"
        >

        <span :class="$style.optionLabel">{{ option.name }}</span>
      </label>
    </div>
  </fieldset>
</template>

<script lang="ts" setup>
  import { computed, useId } from 'vue'
  import type { GearLibraryFilterProperty } from '~/types/equipment'

  interface Props {
    isLimitReached: boolean;
    properties: GearLibraryFilterProperty[];
  }

  const props = defineProps<Props>()
  const selectedOptionsByProperty = defineModel<Record<string, string[]>>({ required: true })
  const componentId = useId()
  const nameCollator = new Intl.Collator('en')

  /** Reads selected enum options without consulting inherited dictionary properties. */
  function getSelectedOptions(propertySlug: string) {
    return Object.hasOwn(selectedOptionsByProperty.value, propertySlug)
      ? selectedOptionsByProperty.value[propertySlug] ?? []
      : []
  }

  const propertyViews = computed(() => props.properties
    .filter((property) => property.dataType === 'enum')
    .map((property) => {
      const selectedOptions = new Set(getSelectedOptions(property.slug))

      const options = (property.enumOptions ?? [])
        .toSorted((left, right) => nameCollator.compare(left.name, right.name))
        .map((option) => {
          const isChecked = selectedOptions.has(option.slug)

          return {
            isChecked,
            controlId: `${componentId}-${property.slug}-${option.slug}`,
            isDisabled: props.isLimitReached && isChecked === false,
            name: option.name,
            slug: option.slug
          }
        })

      return {
        options,
        name: property.name,
        slug: property.slug
      }
    }))

  function handleOptionChange(propertySlug: string, optionSlug: string, event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const currentOptions = getSelectedOptions(propertySlug)

    if (input.checked) {
      selectedOptionsByProperty.value = {
        ...selectedOptionsByProperty.value,
        [propertySlug]: [...new Set([...currentOptions, optionSlug])]
      }
    } else {
      selectedOptionsByProperty.value = {
        ...selectedOptionsByProperty.value,
        [propertySlug]: currentOptions.filter((slug) => slug !== optionSlug)
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
</style>
