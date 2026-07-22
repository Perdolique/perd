<template>
  <GearLibraryItemRowShell
    :class="$style.component"
    has-action
    root-tag="li"
    row-tag="article"
  >
    <template #media="{ className }">
      <div :class="[className, $style.media]" aria-hidden="true">
        <Icon name="hugeicons:package" />
      </div>
    </template>

    <template #identity="{ className }">
      <div :class="className">
        <p :class="$style.brand">
          {{ item.brand.name }}
        </p>

        <h2 :class="$style.heading">
          <PerdLink :class="$style.detailLink" :to="item.detailPath">
            {{ item.name }}
          </PerdLink>
        </h2>

        <p :class="$style.category">
          {{ item.category.name }}
        </p>
      </div>
    </template>

    <template #properties="{ propertiesClass, propertyClass }">
      <dl v-if="hasProperties" :class="propertiesClass">
        <div
          v-for="property in displayProperties"
          :key="property.slug"
          :class="propertyClass"
        >
          <dt :class="$style.propertyName">
            {{ property.name }}
          </dt>

          <dd :class="$style.propertyValue">
            {{ property.displayValue }}
          </dd>
        </div>
      </dl>
    </template>

    <template #action="{ className }">
      <label
        v-if="isComparisonModeActive"
        :for="comparisonControlId"
        :class="[className, $style.comparisonControl]"
      >
        <input
          :id="comparisonControlId"
          :checked="isComparisonSelected"
          :class="$style.comparisonCheckbox"
          :disabled="isComparisonDisabled"
          type="checkbox"
          @change="handleComparisonChange"
        >

        <span :class="$style.comparisonLabel">Select</span>
        <span :class="$style.visuallyHidden"> {{ item.name }}</span>
      </label>

      <GearLibraryMyGearAction
        v-else
        :class="className"
        :has-error="hasMyGearError"
        :is-saved="isInMyGear"
        :is-saving="isMyGearSaving"
        :item-name="item.name"
        @add="emit('myGearAdd', item)"
      />
    </template>
  </GearLibraryItemRowShell>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  import type {
    GearLibraryListItemView,
    GearLibraryListProperty,
    ItemDisplayProperty
  } from '~/types/equipment'

  import PerdLink from '~/components/PerdLink.vue'
  import GearLibraryItemRowShell from './GearLibraryItemRowShell.vue'
  import GearLibraryMyGearAction from './GearLibraryMyGearAction.vue'

  interface Props {
    isComparisonDisabled: boolean;
    isComparisonLimitReached: boolean;
    isComparisonModeActive: boolean;
    isComparisonSelected: boolean;
    hasMyGearError: boolean;
    isInMyGear: boolean;
    isMyGearSaving: boolean;
    item: GearLibraryListItemView;
  }

  interface Emits {
    comparisonChange: [item: GearLibraryListItemView, selected: boolean];
    myGearAdd: [item: GearLibraryListItemView];
  }

  const weightPropertySlug = 'weight'
  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const comparisonControlId = computed(() => `compare-${props.item.id}`)

  function handleComparisonChange(event: Event) {
    const checkbox = event.currentTarget

    if ((checkbox instanceof globalThis.HTMLInputElement) === false) {
      return
    }

    const selected = checkbox.checked
    const shouldRejectSelection = selected
      && props.isComparisonSelected === false
      && props.isComparisonLimitReached

    if (shouldRejectSelection) {
      checkbox.checked = false
    }

    emit('comparisonChange', props.item, selected)
  }

  /** Formats one list property for compact catalog display. */
  function getPropertyDisplayValue(property: GearLibraryListProperty) {
    if (property.value === null) {
      return 'Not set'
    }

    if (property.dataType === 'enum' && property.enumOptionName !== undefined) {
      return property.enumOptionName
    }

    if (typeof property.value === 'boolean') {
      return property.value ? 'Yes' : 'No'
    }

    if (typeof property.value === 'number' && property.unit !== null) {
      return `${property.value} ${property.unit}`
    }

    return String(property.value)
  }

  const hasProperties = computed(() => props.item.properties.length > 0)

  const displayProperties = computed<ItemDisplayProperty[]>(() => {
    const orderedProperties = props.item.properties.toSorted((left, right) => {
      const leftPriority = left.slug === weightPropertySlug ? 0 : 1
      const rightPriority = right.slug === weightPropertySlug ? 0 : 1

      return leftPriority - rightPriority
    })

    return orderedProperties.map((property) => {
      return {
        dataType: property.dataType,
        displayValue: getPropertyDisplayValue(property),
        name: property.name,
        slug: property.slug,
        unit: property.unit,
        value: property.value
      }
    })
  })
</script>

<style module>
  .component {
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:has(.detailLink:hover) {
      border-color: var(--color-border-strong);
      background-color: var(--color-surface-secondary);
    }

    &:has(.detailLink:focus-visible) {
      border-color: var(--color-border-strong);
      box-shadow: var(--shadow-focus);
    }

    &:has(.detailLink:active) {
      background-color: var(--color-accent-subtle);
    }

    @media (forced-colors: active) {
      &:has(.detailLink:focus) {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }
    }
  }

  .media {
    color: var(--color-text-muted);
    font-size: var(--font-size-20);
  }

  .brand {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .heading {
    font-size: var(--font-size-17);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;

    @container (inline-size >= 44rem) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .detailLink {
    position: static;

    &:hover,
    &:focus-visible {
      text-decoration: none;
    }

    &::after {
      content: '';
      position: absolute;
      z-index: 1;
      inset: 0;
    }

    &:focus-visible {
      box-shadow: none;
    }
  }

  .category {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
  }

  .comparisonControl {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-8);
    min-inline-size: var(--layout-touch-target);
    min-block-size: var(--layout-touch-target);
    background-color: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover:not(:has(.comparisonCheckbox:disabled)) {
      background-color: var(--color-surface-secondary);
    }

    &:active:not(:has(.comparisonCheckbox:disabled)) {
      background-color: var(--color-accent-subtle-active);
    }

    &:has(.comparisonCheckbox:checked) {
      background-color: var(--color-accent-subtle);
      color: var(--color-accent-primary);

      &:hover:not(:has(.comparisonCheckbox:disabled)) {
        background-color: var(--color-accent-subtle-hover);
      }

      &:active:not(:has(.comparisonCheckbox:disabled)) {
        background-color: var(--color-accent-subtle-active);
      }
    }

    &:has(.comparisonCheckbox:focus-visible) {
      box-shadow: var(--shadow-focus);
    }

    &:has(.comparisonCheckbox:disabled) {
      background-color: var(--color-surface-secondary);
      color: var(--color-text-muted);
      cursor: not-allowed;
    }

    @container (inline-size >= 44rem) {
      justify-content: center;
    }
  }

  .comparisonCheckbox {
    inline-size: 1.125rem;
    block-size: 1.125rem;
    margin: 0;
    accent-color: var(--color-accent-primary);
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
    }
  }

  .visuallyHidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    border: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .propertyName {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .propertyValue {
    color: var(--color-text-primary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }
</style>
