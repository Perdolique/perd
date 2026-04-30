<template>
  <component
    :is="tag"
    :class="[$style.component, headingLevelClass]"
  >
    <slot />
  </component>
</template>

<script lang="ts">
  export type HeadingLevel = 1 | 2
</script>

<script lang="ts" setup>
  import { computed } from 'vue'

  interface Props {
    level: HeadingLevel;
  }

  const { level } = defineProps<Props>()

  const tag = computed(() => `h${level}` as const)
  const headingLevelClass = computed(() => tag.value)
</script>

<style module>
  .component {
    padding: 0;
    margin: 0;
    letter-spacing: 0;
    color: var(--color-text-primary);

    &:global(.h1) {
      font-size: var(--font-size-32);
      font-weight: var(--font-weight-bold);
      line-height: var(--line-height-tight);
    }

    &:global(.h2) {
      font-size: var(--font-size-20);
      font-weight: var(--font-weight-bold);
      line-height: var(--line-height-snug);
    }
  }
</style>
