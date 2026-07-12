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
          <PerdLink :to="item.detailPath">
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
  import type { GearLibraryListItemView, ItemDisplayProperty, ItemProperty } from '~/types/equipment'
  import PerdLink from '~/components/PerdLink.vue'

  interface Props {
    item: GearLibraryListItemView;
  }

  const props = defineProps<Props>()

  function getPropertyDisplayValue(property: ItemProperty) {
    if (property.value === null) {
      return 'Not set'
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

  const displayProperties = computed<ItemDisplayProperty[]>(() => props.item.properties.map((property) => {
    const displayValue = getPropertyDisplayValue(property)

    return {
      displayValue,
      dataType: property.dataType,
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      value: property.value
    }
  }))
</script>

<style module>
  .component {
    container-type: inline-size;
    border-block-end: 1px solid var(--color-border-subtle);

    &:last-child {
      border-block-end: 0;
    }
  }

  .row {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr);
    grid-template-areas:
      "media identity"
      "properties properties";
    align-items: start;
    gap: var(--spacing-16);
    padding: var(--spacing-16);

    @container (inline-size >= 44rem) {
      grid-template-columns: 3rem minmax(10rem, 0.7fr) minmax(0, 1fr);
      grid-template-areas: "media identity properties";
      align-items: center;
      padding: var(--spacing-20) var(--spacing-24);
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

  .category {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
  }

  .properties {
    grid-area: properties;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
    gap: var(--spacing-8);
  }

  .property {
    display: grid;
    align-content: start;
    gap: var(--spacing-4);
    padding: var(--spacing-12);
    border-radius: var(--border-radius-12);
    background-color: var(--color-surface-secondary);
  }

  .propertyName {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    line-height: var(--line-height-snug);
  }

  .propertyValue {
    color: var(--color-text-primary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }
</style>
