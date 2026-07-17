<template>
  <li :class="$style.component">
    <article :class="$style.row">
      <div :class="$style.media" aria-hidden="true">
        <Icon name="hugeicons:package" />
      </div>

      <div :class="$style.identity">
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

      <dl v-if="hasProperties" :class="$style.properties">
        <div
          v-for="property in displayProperties"
          :key="property.slug"
          :class="$style.property"
        >
          <dt :class="$style.propertyName">
            {{ property.name }}
          </dt>

          <dd :class="$style.propertyValue">
            {{ property.displayValue }}
          </dd>
        </div>
      </dl>
    </article>
  </li>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type {
    GearLibraryListItemView,
    GearLibraryListProperty,
    ItemDisplayProperty
  } from '~/types/equipment'
  import PerdLink from '~/components/PerdLink.vue'

  interface Props {
    item: GearLibraryListItemView;
  }

  const weightPropertySlug = 'weight'
  const props = defineProps<Props>()

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
      const displayValue = getPropertyDisplayValue(property)

      return {
        displayValue,
        dataType: property.dataType,
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
    position: relative;
    container-type: inline-size;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-primary);
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
  }

  .row {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr);
    grid-template-areas:
      "media identity"
      "properties properties";
    align-items: start;
    gap: var(--spacing-12);
    padding: var(--spacing-12) var(--spacing-16);

    @container (inline-size >= 44rem) {
      grid-template-columns: 3rem minmax(10rem, 0.7fr) minmax(0, 1fr);
      grid-template-areas: "media identity properties";
      align-items: center;
    }
  }

  .media {
    grid-area: media;
    display: grid;
    place-items: center;
    inline-size: 3rem;
    aspect-ratio: 1;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-14);
    background-color: var(--color-surface-secondary);
    color: var(--color-text-muted);
    font-size: var(--font-size-20);
  }

  .identity {
    grid-area: identity;
    display: grid;
    align-content: center;
    gap: var(--spacing-4);
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

  .properties {
    grid-area: properties;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: auto auto;
    align-items: start;
    row-gap: var(--spacing-4);

    &:has(> .property:only-child) {
      grid-template-columns: minmax(0, 1fr);
    }

    &:has(> .property:nth-child(2):last-child) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .property {
    display: grid;
    grid-row: span 2;
    grid-template-rows: subgrid;
    align-content: start;
    min-inline-size: 0;
    padding-inline: var(--spacing-12);
    border-inline-start: 1px solid var(--color-border-subtle);

    &:first-child {
      border-inline-start-width: 0;
    }

    @container (inline-size >= 44rem) {
      &:first-child {
        border-inline-start-width: 1px;
      }
    }
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

  @media (forced-colors: active) {
    .component:has(.detailLink:focus) {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
