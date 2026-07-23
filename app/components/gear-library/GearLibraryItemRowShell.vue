<template>
  <component :is="rootTag" :class="$style.component">
    <component :is="rowTag" :class="[$style.row, { hasAction }]">
      <div :class="$style.content">
        <slot name="media" :class-name="$style.media" />
        <slot name="identity" :class-name="$style.identity" />

        <slot
          name="properties"
          :properties-class="$style.properties"
          :property-class="$style.property"
        />
      </div>

      <slot v-if="hasAction" name="action" :class-name="$style.action" />
    </component>
  </component>
</template>

<script lang="ts" setup>
  interface Props {
    hasAction?: boolean;
    rootTag?: 'div' | 'li';
    rowTag?: 'article' | 'div';
  }

  const {
    hasAction,
    rootTag = 'div',
    rowTag = 'div'
  } = defineProps<Props>()
</script>

<style module>
  .component {
    --action-rail-inline-size: 12rem;

    position: relative;
    container-type: inline-size;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-primary);
  }

  .row {
    display: grid;
  }

  .content {
    position: relative;
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
    /* Let desktop item names shrink into their ellipsis instead of widening the grid track. */
    min-inline-size: 0;
  }

  .action {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    padding: var(--spacing-12) var(--spacing-16);
    border-block-start: 1px solid var(--color-border-subtle);
    border-end-start-radius: var(--border-radius-16);
    border-end-end-radius: var(--border-radius-16);

    @container (inline-size >= 44rem) {
      justify-content: center;
      inline-size: var(--action-rail-inline-size);
      border-block-start: 0;
      border-inline-start: 1px solid var(--color-border-subtle);
      border-start-end-radius: var(--border-radius-16);
      border-end-start-radius: 0;
    }
  }

  .row:global(.hasAction) {
    @container (inline-size >= 44rem) {
      grid-template-columns: minmax(0, 1fr) auto;
    }
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
