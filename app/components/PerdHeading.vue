<template>
  <component
    :is="tag"
    :class="headingClass"
  >
    <slot />
  </component>
</template>

<script lang="ts">
  export type HeadingLevel = 1 | 2 | 3
</script>

<script lang="ts" setup>
  import { computed, useCssModule } from 'vue'

  interface Props {
    level: HeadingLevel;
  }

  const { level } = defineProps<Props>()
  const styles = useCssModule()

  const tag = computed(() => `h${level}` as const)
  const headingClass = computed(() => [styles.component, tag.value])
</script>

<style module>
  .component {
    padding: 0;
    margin: 0;
    letter-spacing: -0.03em;
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

    &:global(.h3) {
      font-size: var(--font-size-16);
      font-weight: var(--font-weight-semibold);
      line-height: var(--line-height-snug);
    }
  }
</style>
