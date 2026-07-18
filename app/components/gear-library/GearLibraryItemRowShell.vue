<template>
  <component :is="rootTag" :class="$style.component">
    <component :is="rowTag" :class="$style.row">
      <slot name="media" :class-name="$style.media" />
      <slot name="identity" :class-name="$style.identity" />

      <slot
        name="properties"
        :properties-class="$style.properties"
        :property-class="$style.property"
      />
    </component>
  </component>
</template>

<script lang="ts" setup>
  interface Props {
    rootTag?: 'div' | 'li';
    rowTag?: 'article' | 'div';
  }

  const {
    rootTag = 'div',
    rowTag = 'div'
  } = defineProps<Props>()
</script>

<style module>
  .component {
    position: relative;
    container-type: inline-size;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-primary);
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
  }

  .identity {
    grid-area: identity;
    display: grid;
    align-content: center;
    gap: var(--spacing-4);
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
</style>
