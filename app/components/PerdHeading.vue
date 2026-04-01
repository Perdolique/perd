<template>
  <component
    :is="tag"
    :class="[$style.component, tag]"
  >
    <slot />
  </component>
</template>

<script lang="ts">
  export type HeadingLevel = 1 | 2 | 3
</script>

<script lang="ts" setup>
  import { computed } from 'vue'

  interface Props {
    level: HeadingLevel;
  }

  const { level } = defineProps<Props>()

  const tag = computed(() => `h${level}` as const)
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
