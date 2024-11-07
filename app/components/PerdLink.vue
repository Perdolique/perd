<template>
  <NuxtLink :class="$style.component">
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
  .component {
    outline: none;
    color: var(--primary-700);
    position: relative;
    text-decoration: none;
    transition: color var(--transition-time-quick);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      text-decoration: underline;
      color: var(--primary-600);
    }

    &:active {
      color: var(--primary-500);
    }
  }
</style>
