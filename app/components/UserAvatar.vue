<template>
  <span :class="[$style.component, size]" aria-hidden="true">
    {{ initial }}
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
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--color-accent-subtle);
    color: var(--color-accent-base);
    font-weight: var(--font-weight-bold);

    &:global(.large) {
      width: 4rem;
      height: 4rem;
      font-size: var(--font-size-20);
    }

    &:global(.medium) {
      width: 2.5rem;
      height: 2.5rem;
    }
  }
</style>
