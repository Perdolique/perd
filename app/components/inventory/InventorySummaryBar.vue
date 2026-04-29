<template>
  <div :class="$style.component">
    <div>
      <p :class="$style.label">
        My gear
      </p>

      <p :class="$style.count">
        {{ summaryText }}
      </p>
    </div>

    <p :class="$style.copy">
      Everything already in your kit, ready to revisit from the catalog.
    </p>
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    summaryText: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-16);
    align-items: end;
  }

  .label,
  .count,
  .copy {
    margin: 0;
  }

  .label {
    margin-bottom: var(--spacing-8);
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .count {
    color: var(--color-text-primary);
    font-size: var(--font-size-24);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
  }

  .copy {
    max-width: 24rem;
    color: var(--color-text-tertiary);
    text-align: right;
  }

  @media (width < 640px) {
    .copy {
      text-align: left;
    }
  }
</style>
