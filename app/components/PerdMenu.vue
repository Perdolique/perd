<template>
  <div
    ref="rootRef"
    :class="$style.component"
  >
    <PerdButton
      secondary
      small
      :icon="icon"
      @click.passive="toggleMenu"
    >
      {{ text }}
    </PerdButton>

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
  import PerdButton from './PerdButton.vue';

  interface Props {
    readonly icon: string;
    readonly text: string;
  }

  defineProps<Props>()

  const isMenuVisible = ref(false)
  const rootRef = useTemplateRef('rootRef')

  function toggleMenu() {
    isMenuVisible.value = !isMenuVisible.value
  }

  onClickOutside(rootRef, () => {
    isMenuVisible.value = false
  }, {
    ignore: ['dialog']
  });
</script>

<style module>
  .component {
    position: relative;
  }

  .menu {
    --spacing: var(--spacing-4);
    --transition-duration: 0.15s;

    display: none;
    position: absolute;
    opacity: 0;
    transform: translateY(calc(-1 * var(--spacing)));
    top: calc(100% + var(--spacing));
    right: 0;
    overflow: hidden;
    background-color: var(--color-background);
    border: 1px solid var(--color-blue-400);;
    border-radius: var(--border-radius-12);
    box-shadow: var(--shadow-2);
    transition:
      transform var(--transition-duration) ease-out,
      opacity var(--transition-duration) ease-out,
      display var(--transition-duration) allow-discrete;

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
