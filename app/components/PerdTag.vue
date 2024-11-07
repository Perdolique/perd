<template>
  <div :class="$style.component">
    <Icon
      :name="icon"
      size="14px"
    />

    <slot />
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    readonly icon: string;
    readonly color?: 'green' | 'gray' | 'blue';
  }

  const { color } = defineProps<Props>()

  const tagColor = computed(() => {
    switch (color) {
      case 'green': {
        return 'oklch(95% 0.12 140)'
      }

      case 'blue': {
        return 'oklch(95% 0.1 250)'
      }

      case 'gray':
      default: {
        return 'oklch(90% 0 0)'
      }
    }
  });
</script>

<style module>
  .component {
    display: flex;
    align-items: center;
    color: var(--text-color-secondary);
    column-gap: var(--spacing-2);
    font-size: var(--font-size-14);
    background-color: v-bind(tagColor);
    padding: var(--spacing-4) var(--spacing-8);
    border-radius: var(--border-radius-8);
    font-weight: var(--font-weight-medium);
    border: 1px solid color-mix(in oklch, v-bind(tagColor), black 5%);
  }
</style>
