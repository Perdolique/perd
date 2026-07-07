<template>
  <li :class="$style.component">
    <PerdCard :class="$style.card">
      <div :class="$style.content">
        <span :class="$style.icon" aria-hidden="true">
          <Icon name="hugeicons:package" />
        </span>

        <div :class="$style.body">
          <p :class="$style.source">
            {{ entry.sourceText }}
          </p>

          <p :class="$style.title">
            {{ entry.title }}
          </p>

          <p v-if="hasSubtitle" :class="$style.subtitle">
            {{ entry.subtitle }}
          </p>
        </div>

        <PerdPill :tone="packedStatusTone">
          {{ entry.packedStatusText }}
        </PerdPill>
      </div>
    </PerdCard>
  </li>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { PackingListEntryView } from '~/types/packing'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdPill, { type PerdPillTone } from '~/components/PerdPill.vue'

  interface Props {
    entry: PackingListEntryView;
  }

  const props = defineProps<Props>()

  const hasSubtitle = computed(() => props.entry.subtitle !== '')
  const packedStatusTone = computed<PerdPillTone>(() => props.entry.isPacked ? 'success' : 'neutral')
</script>

<style module>
  .component {
    list-style: none;
  }

  .card {
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-accent-primary), transparent 96%),
        var(--color-surface-primary)
      );
  }

  .content {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--spacing-12);

    @container (inline-size >= 34rem) {
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
    }
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--border-radius-16);
    background-color: var(--color-accent-subtle);
    color: var(--color-accent-primary);
    font-size: 1.1rem;
  }

  .body {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .source {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    letter-spacing: var(--letter-spacing-label);
    line-height: var(--line-height-snug);
    text-transform: uppercase;
  }

  .title {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-18);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .subtitle {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-14);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }
</style>
