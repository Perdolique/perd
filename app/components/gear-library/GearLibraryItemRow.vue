<template>
  <GearLibraryItemRowShell
    :class="$style.component"
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

  interface Props {
    item: GearLibraryListItemView;
  }

  const weightPropertySlug = 'weight'
  const props = defineProps<Props>()

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
