<template>
  <span :class="[$style.component, size]" aria-hidden="true">
    <span :class="$style.initial">
      {{ initial }}
    </span>
  </span>
</template>

<script lang="ts" setup>
  interface Props {
    initial: string;
    size?: 'medium' | 'large';
  }

  const {
    size = 'medium'
  } = defineProps<Props>()
</script>

<style module>
  .component {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--color-accent-subtle);
    color: var(--color-accent-base);
    font-weight: var(--font-weight-bold);
    line-height: 1;
    border: 1px solid var(--color-accent-ring);

    &:global(.large) {
      width: 4rem;
      height: 4rem;
      font-size: var(--font-size-20);
    }

    &:global(.medium) {
      width: 2.5rem;
      height: 2.5rem;
      font-size: var(--font-size-16);
    }
  }

  .initial {
    display: block;
    line-height: 1;
    transform: translateY(0.02em);
  }
</style>
