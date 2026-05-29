<template>
  <NuxtLink :class="$style.component">
    <slot />
  </NuxtLink>
</template>

<script lang="ts" setup></script>

<style module>
  .component {
    color: var(--color-accent-primary);
    position: relative;
    text-decoration: none;
    transition:
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);
    cursor: pointer;
    font-weight: var(--font-weight-semibold);

    &:hover {
      text-decoration: underline;
      color: var(--color-accent-hover);
    }

    &:focus-visible {
      text-decoration: underline;
      color: var(--color-accent-hover);
      box-shadow: var(--shadow-focus);
    }

    &:active {
      color: var(--color-accent-active);
    }
  }
</style>
