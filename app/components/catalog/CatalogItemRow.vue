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
        <span :class="$style.tag">
          {{ item.category.name }}
        </span>

        <Icon name="tabler:arrow-up-right" :class="$style.arrow" aria-hidden="true" />
      </div>
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import type { CatalogListItemView } from '~/types/equipment'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'

  interface Props {
    item: CatalogListItemView;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    padding: var(--spacing-16);
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
    min-width: 0;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--border-radius-16);
    background: var(--color-accent-subtle);
    color: var(--color-accent-base);
    flex-shrink: 0;
  }

  .text {
    min-width: 0;
    display: grid;
    gap: 0.1rem;
  }

  .brand {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: 0.12em;
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
    margin-left: auto;
  }

  .tag {
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    background: var(--color-surface-subtle);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-subtle);
    font-size: var(--font-size-12);
  }

  .arrow {
    color: var(--color-text-muted);
  }

  @media (width < 640px) {
    .meta {
      width: 100%;
      justify-content: space-between;
      margin-left: 0;
    }
  }
</style>
