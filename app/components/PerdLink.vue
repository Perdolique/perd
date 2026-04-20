<template>
  <NuxtLink :class="$style.component">
    <slot />
  </NuxtLink>
</template>

<script lang="ts" setup></script>

<style module>
  .component {
    outline: none;
    color: var(--color-accent-base);
    position: relative;
    text-decoration: none;
    transition: color var(--transition-duration-quick) var(--transition-easing-out);
    cursor: pointer;
    font-weight: var(--font-weight-medium);

    &:hover,
    &:focus-visible {
      text-decoration: underline;
      color: var(--color-accent-hover);
    }

    &:active {
      color: var(--color-accent-active);
    }
  }
</style>
