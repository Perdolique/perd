<template>
  <PerdCard :class="$style.component">
    <PerdPill :class="$style.badge">
      {{ categoryName }}
    </PerdPill>

    <span :class="$style.icon" aria-hidden="true">
      <Icon name="tabler:backpack" />
    </span>
  </PerdCard>
</template>

<script lang="ts" setup>
  import PerdCard from '~/components/PerdCard.vue'
  import PerdPill from '~/components/PerdPill.vue'

  interface Props {
    categoryName: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    position: relative;
    min-block-size: 18rem;
    overflow: hidden;
    display: grid;
    gap: var(--spacing-24);
    place-items: center;
    container-type: inline-size;
    background:
      radial-gradient(circle at top center, color-mix(in oklch, var(--color-accent-base), transparent 78%), transparent 35%),
      linear-gradient(180deg, var(--color-surface-base), var(--color-background-sunken));
  }

  .badge {
    position: absolute;
    inset-block-start: var(--spacing-16);
    inset-inline-start: var(--spacing-16);
    background: var(--color-surface-base);
  }

  .icon {
    display: grid;
    place-items: center;
    inline-size: min(10rem, 45cqi);
    block-size: min(10rem, 45cqi);
    border-radius: 2rem;
    background: color-mix(in oklch, var(--color-surface-base), transparent 8%);
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-secondary);
    font-size: clamp(4rem, 10vw, 5.5rem);
  }
</style>
