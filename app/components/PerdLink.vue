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
    font-size: 0.9rem;
    color: var(--color-blue-700);
    transition: color 0.15s ease-out;

    &:hover {
      color: var(--color-blue-950);
    }
  }
</style>
