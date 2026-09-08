<template>
  <main :class="$style.component">
    <section :class="$style.panel" :aria-labelledby="headingId">
      <div :class="$style.intro">
        <p :class="$style.brand">Metsik</p>
        <h1 :id="headingId" :class="$style.heading">{{ title }}</h1>
        <p :class="$style.description">{{ description }}</p>
      </div>
      <slot />
    </section>
  </main>
</template>

<script lang="ts" setup>
  import { useId } from 'vue'

  interface Props {
    title: string;
    description: string;
  }

  defineProps<Props>()

  const headingId = useId()
</script>

<style module>
  .component {
    min-block-size: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--spacing-24) var(--spacing-16);
    background: var(--color-background-muted);
  }

  .panel {
    inline-size: min(100%, 28rem);
    display: grid;
    gap: var(--spacing-24);
    padding: var(--spacing-24);
    background: var(--color-surface-primary);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-24);
    box-shadow: var(--shadow-large);
  }

  .intro {
    display: grid;
    gap: var(--spacing-12);
  }

  .brand {
    color: var(--color-accent-primary);
    font-weight: var(--font-weight-semibold);
  }

  .heading {
    font-size: var(--font-size-30);
    line-height: var(--line-height-tight);
  }

  .description {
    color: var(--color-text-secondary);
  }
</style>
