<template>
  <NuxtLink :to="item.detailPath" :class="$style.component">
    <div :class="$style.row">
      <div :class="$style.identity">
        <span :class="$style.icon" aria-hidden="true">
          <Icon name="tabler:backpack" />
        </span>

        <div :class="$style.text">
          <p :class="$style.brand">
            {{ item.brand.name }}
          </p>

          <span :class="$style.name">
            {{ item.name }}
          </span>
        </div>
      </div>

      <div :class="$style.meta">
        <PerdPill :class="$style.tag">
          {{ item.category.name }}
        </PerdPill>

        <Icon name="tabler:arrow-up-right" :class="$style.arrow" aria-hidden="true" />
      </div>
    </div>
  </NuxtLink>
</template>

<script lang="ts" setup>
  import type { CatalogListItemView } from '~/types/equipment'
  import PerdPill from '~/components/PerdPill.vue'

  interface Props {
    item: CatalogListItemView;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: grid;
    container-type: inline-size;
    padding: var(--spacing-12) var(--spacing-16);
    border-block-end: 1px solid var(--color-border-subtle);
    color: inherit;
    text-decoration: none;
    transition:
      background-color var(--transition-duration-quick) var(--transition-easing-out),
      box-shadow var(--transition-duration-quick) var(--transition-easing-out);

    &:hover {
      background-color: var(--color-surface-subtle);
    }

    &:focus-visible {
      background-color: var(--color-surface-subtle);
      box-shadow: inset 0 0 0 2px var(--color-accent-ring);
      outline: none;
    }

    &:active {
      background-color: color-mix(in oklch, var(--color-surface-subtle), var(--color-accent-subtle) 24%);
    }

    &:last-child {
      border-block-end: 0;
    }
  }

  .row {
    display: grid;
    gap: var(--spacing-12);

    @container (inline-size >= 40rem) {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
  }

  .identity {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
    min-inline-size: 0;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border-radius: var(--border-radius-12);
    background-color: var(--color-surface-subtle);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-subtle);
    font-size: 1rem;
  }

  .text {
    min-inline-size: 0;
    display: grid;
    gap: 0.15rem;
  }

  .brand {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .name {
    color: var(--color-text-primary);
    font-size: var(--font-size-16);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;

    .component:hover &,
    .component:focus-visible & {
      color: var(--color-text-primary);
    }
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-8);

    @container (inline-size >= 40rem) {
      justify-content: end;
    }
  }

  .tag {
    max-inline-size: 100%;
  }

  .arrow {
    color: var(--color-text-muted);
  }

  @container (inline-size < 40rem) {
    .meta {
      inline-size: 100%;
      justify-content: space-between;
    }
  }
</style>
