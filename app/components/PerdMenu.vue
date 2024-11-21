<template>
  <div
    ref="rootRef"
    :class="$style.component"
  >
    <slot
      name="trigger"
      :toggle-menu="toggleMenu"
      :is-menu-visible="isMenuVisible"
    />

    <div
      :class="[$style.menu, {
        visible: isMenuVisible
      }]"
    >
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { onClickOutside } from '@vueuse/core';

  const isMenuVisible = ref(false)
  const rootRef = useTemplateRef('rootRef')

  function toggleMenu() {
    isMenuVisible.value = !isMenuVisible.value
  }

  onClickOutside(rootRef, () => {
    isMenuVisible.value = false
  });
</script>

<style module>
  .component {
    position: relative;
  }

  .menu {
    --spacing: var(--spacing-4);

    display: none;
    position: absolute;
    opacity: 0;
    transform: translateY(calc(-1 * var(--spacing)));
    top: calc(100% + var(--spacing));
    right: 0;
    z-index: 1;
    overflow: hidden;
    background-color: var(--secondary-50);
    border: 1px solid var(--secondary-200);
    border-radius: var(--border-radius-12);
    box-shadow: var(--shadow-2);
    transition:
      transform var(--transition-time-quick) ease-out,
      opacity var(--transition-time-quick) ease-out,
      display var(--transition-time-quick) allow-discrete;

    &:global(.visible) {
      display: block;
      opacity: 1;
      transform: translateY(0);

      @starting-style {
        opacity: 0;
        transform: translateY(calc(-1 * var(--spacing)));
      }
    }
  }
</style>
