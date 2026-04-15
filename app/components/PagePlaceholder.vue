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
    width: 100%;
  }

  .card {
    width: 100%;
    max-width: 40rem;
    box-sizing: border-box;
    margin: 0 auto;
    background:
      radial-gradient(circle at top center, color-mix(in oklch, var(--color-primary), transparent 78%), transparent 38%),
      linear-gradient(180deg, var(--color-background-50), var(--color-background-100));
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
    max-width: 32rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .actions {
    display: flex;
    justify-content: center;
  }
</style>
