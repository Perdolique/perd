<template>
  <div :class="$style.component">
    <PerdCard :class="$style.card">
      <div :class="$style.body">
        <div :class="$style.emojiMark" aria-hidden="true">
          {{ emoji }}
        </div>

        <PerdHeading :level="2">
          {{ title }}
        </PerdHeading>

        <p :class="$style.content">
          <slot />
        </p>

        <div v-if="$slots.actions" :class="$style.actions">
          <slot name="actions" />
        </div>
      </div>
    </PerdCard>
  </div>
</template>

<script lang="ts" setup>
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    emoji: string;
    title: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    inline-size: 100%;
  }

  .card {
    inline-size: 100%;
    max-inline-size: 42rem;
    box-sizing: border-box;
    margin: 0 auto;
    background:
      radial-gradient(circle at top center, color-mix(in oklch, var(--color-accent-base), transparent 80%), transparent 42%),
      linear-gradient(180deg, var(--color-surface-base), var(--color-surface-subtle));
  }

  .body {
    display: grid;
    gap: var(--spacing-16);
    justify-items: center;
    text-align: center;
  }

  .emojiMark {
    font-size: clamp(3rem, 8vw, 4.5rem);
    line-height: 1;
  }

  .content {
    margin: 0;
    max-inline-size: 32rem;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--spacing-8);
  }
</style>
