<template>
  <PerdCard :class="$style.component">
    <span :class="$style.badge">
      {{ categoryName }}
    </span>

    <span :class="$style.icon" aria-hidden="true">
      <Icon name="tabler:backpack" />
    </span>
  </PerdCard>
</template>

<script lang="ts" setup>
  import PerdCard from '~/components/PerdCard.vue'

  interface Props {
    categoryName: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    position: relative;
    min-height: 18rem;
    overflow: hidden;
    display: grid;
    gap: var(--spacing-24);
    place-items: center;
    background:
      radial-gradient(circle at top center, color-mix(in oklch, var(--color-accent-base), transparent 78%), transparent 35%),
      linear-gradient(180deg, var(--color-surface-base), var(--color-background-sunken));
  }

  .badge {
    position: absolute;
    top: var(--spacing-16);
    left: var(--spacing-16);
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    background: var(--color-surface-base);
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
  }

  .icon {
    display: grid;
    place-items: center;
    width: min(10rem, 30vw);
    height: min(10rem, 30vw);
    border-radius: 2rem;
    background: color-mix(in oklch, var(--color-surface-base), transparent 8%);
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-secondary);
    font-size: clamp(4rem, 10vw, 5.5rem);
  }
</style>
