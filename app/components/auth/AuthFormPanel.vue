<template>
  <section :class="$style.component" :aria-labelledby="headingId">
    <div :class="$style.intro">
      <h1 :id="headingId" :class="$style.heading">{{ title }}</h1>
      <p v-if="description" :class="$style.description">{{ description }}</p>
    </div>
    <slot />
  </section>
</template>

<script lang="ts" setup>
  import { useId } from 'vue'

  interface Props {
    title: string;
    description?: string;
  }

  defineProps<Props>()

  const headingId = useId()
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-20);
    padding: var(--spacing-24);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-24);
    box-shadow: var(--shadow-large);

    @media (width < 360px) {
      padding-inline: var(--spacing-16);
    }
  }

  .intro {
    display: grid;
    gap: var(--spacing-12);
  }

  .heading {
    font-size: var(--font-size-30);
    line-height: var(--line-height-tight);
  }

  .description {
    color: var(--color-text-secondary);
  }
</style>
