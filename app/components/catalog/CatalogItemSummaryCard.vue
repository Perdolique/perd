<template>
  <PerdCard :class="$style.component">
    <div :class="$style.header">
      <p :class="$style.eyebrow">
        {{ brandName }}
      </p>

      <span :class="[$style.statusBadge, statusClass]">
        {{ statusText }}
      </span>
    </div>

    <p :class="$style.text">
      {{ categoryName }} gear entry ready for inventory tracking and future packing workflows.
    </p>

    <dl :class="$style.metadataList">
      <div :class="$style.metadataItem">
        <dt :class="$style.metadataLabel">
          Brand
        </dt>

        <dd :class="$style.metadataValue">
          {{ brandName }}
        </dd>
      </div>

      <div :class="$style.metadataItem">
        <dt :class="$style.metadataLabel">
          Category
        </dt>

        <dd :class="$style.metadataValue">
          {{ categoryName }}
        </dd>
      </div>

      <div :class="$style.metadataItem">
        <dt :class="$style.metadataLabel">
          Status
        </dt>

        <dd :class="$style.metadataValue">
          {{ statusText }}
        </dd>
      </div>
    </dl>
  </PerdCard>
</template>

<script lang="ts" setup>
  interface Props {
    brandName: string;
    categoryName: string;
    statusClass: string;
    statusText: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-12);
    align-items: center;
  }

  .eyebrow,
  .text {
    margin: 0;
  }

  .eyebrow {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }

  .text {
    color: var(--color-text-tertiary);
  }

  .statusBadge {
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);

    &:global(.approved) {
      background: var(--color-success-subtle);
      color: var(--color-success);
    }

    &:global(.pending) {
      background: var(--color-warning-subtle);
      color: var(--color-warning);
    }

    &:global(.rejected) {
      background: var(--color-danger-subtle);
      color: var(--color-danger);
    }
  }

  .metadataList {
    display: grid;
    gap: var(--spacing-12);

    @media (width >= 640px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .metadataItem {
    display: grid;
    gap: var(--spacing-8);
    padding: var(--spacing-12);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border-subtle);
  }

  .metadataLabel {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .metadataValue {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
  }
</style>
