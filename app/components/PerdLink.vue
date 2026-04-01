<template>
  <NuxtLink :class="$style.component">
    <slot />
  </NuxtLink>
</template>

<script lang="ts" setup></script>

<style module>
  .component {
    outline: none;
    color: var(--color-primary-700);
    position: relative;
    text-decoration: none;
    transition: color var(--transition-time-quick);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      text-decoration: underline;
      color: var(--color-primary-600);
    }

    &:active {
      color: var(--color-primary-500);
    }
  }
</style>
