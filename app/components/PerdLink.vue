<template>
  <NuxtLink :class="$style.root">
    <slot />
  </NuxtLink>
</template>

<script lang="ts" setup>
  interface Slots {
    default: string;
  }

  const slots = defineSlots<Slots>()
</script>

<style module>
  .root {
    outline: none;
    color: var(--primary-700);
    border-bottom: 1px solid transparent;
    text-decoration: none;

    transition:
      border-color var(--transition-time-quick),
      color var(--transition-time-quick);

    &:hover,
    &:focus-visible {
      color: var(--primary-600);
      border-color: var(--primary-600);
    }

    &:active {
      color: var(--primary-500);
      border-color: var(--primary-500);
    }
  }
</style>
