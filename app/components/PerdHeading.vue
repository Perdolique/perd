<template>
  <component
    :is="element.name"
    :class="[$style.component, element.className]"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
  interface Props {
    readonly level: 1 | 2 | 3;
  }

  const { level } = defineProps<Props>();

  const element = computed(() => {
    switch (level) {
      case 1: {
        return {
          name: 'h1',
          className: 'h1'
        };
      }

      case 2: {
        return {
          name: 'h2',
          className: 'h2'
        };
      }

      case 3: {
        return {
          name: 'h3',
          className: 'h3'
        };
      }
    }
  });
</script>

<style module>
  .component {
    padding: 0;
    margin: 0;

    &:global(.h1) {
      font-size: var(--font-size-24);
      font-weight: var(--font-weight-bold);
    }

    &:global(.h2) {
      font-size: var(--font-size-20);
      font-weight: var(--font-weight-bold);
    }

    &:global(.h3) {
      font-size: var(--font-size-16);
      font-weight: var(--font-weight-bold);
    }
  }
</style>
