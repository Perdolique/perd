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
      <slot />
    </PerdButton>

    <div
      :class="[$style.menu, {
        visible: isMenuVisible
      }]"
    >
      <button
        v-for="(item, index) in items"
        :key="index"
        :class="$style.item"
        @click="handleItemClick(item)"
      >
        <Icon
          :name="item.icon"
          size="1.125em"
        />

        <span>{{ item.text }}</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup generic="Item extends MenuItem">
  import { onClickOutside } from '@vueuse/core';
  import PerdButton from './PerdButton.vue';

  export interface MenuItem {
    readonly icon: string;
    readonly text: string;
    readonly event: string;
  }

  interface Props {
    readonly items: Item[];
    readonly icon: string;
  }

  type Emits = (event: 'itemClick', item: Item) => void;

  defineProps<Props>()

  const emit = defineEmits<Emits>()
  const isMenuVisible = ref(false)
  const rootRef = ref<HTMLDivElement | null>(null)

  function toggleMenu() {
    isMenuVisible.value = !isMenuVisible.value
  }

  onClickOutside(rootRef, () => {
    isMenuVisible.value = false
  });

  function handleItemClick(item: Item) {
    emit('itemClick', item)

    isMenuVisible.value = false
  }
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

  .item {
    /* reset button style */
    border: none;
    outline: none;
    text-align: inherit;
    width: 100%;

    /* item style */
    display: flex;
    align-items: center;
    column-gap: var(--spacing-8);
    padding: var(--spacing-8) var(--spacing-48) var(--spacing-8) var(--spacing-12);
    background-color: var(--color-background);
    color: var(--color-blue-600);
    cursor: pointer;
    transition: background-color 0.2s ease-out;
    font-size: var(--font-size-14);

    &:hover,
    &:focus-visible {
      background-color: var(--color-blue-100);
    }
  }
</style>
