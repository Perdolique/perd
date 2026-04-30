<template>
  <PerdCard :class="$style.component">
    <div :class="$style.row">
      <div :class="$style.identity">
        <span :class="$style.icon" aria-hidden="true">
          <Icon name="tabler:backpack" />
        </span>

        <div :class="$style.text">
          <p :class="$style.brand">
            {{ item.brand.name }}
          </p>

          <PerdLink :to="item.detailPath" :class="$style.name">
            {{ item.name }}
          </PerdLink>
        </div>
      </div>

      <div :class="$style.meta">
        <PerdPill :class="$style.tag">
          {{ item.category.name }}
        </PerdPill>

        <Icon name="tabler:arrow-up-right" :class="$style.arrow" aria-hidden="true" />
      </div>
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import type { CatalogListItemView } from '~/types/equipment'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PerdPill from '~/components/PerdPill.vue'

  interface Props {
    item: CatalogListItemView;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    padding: var(--spacing-16);
    container-type: inline-size;
    background:
      linear-gradient(
        135deg,
        color-mix(in oklch, var(--color-accent-base), transparent 94%),
        var(--color-surface-base)
      );
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-16);
    align-items: center;
    justify-content: space-between;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    min-inline-size: 0;
  }

  .icon {
    display: grid;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border-radius: var(--border-radius-16);
    background: var(--color-accent-subtle);
    color: var(--color-accent-base);
    flex-shrink: 0;
  }

  .text {
    min-inline-size: 0;
    display: grid;
    gap: 0.1rem;
  }

  .brand {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .name {
    font-size: var(--font-size-16);
    color: var(--color-text-primary);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    margin-inline-start: auto;
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
      margin-inline-start: 0;
    }
  }
</style>
