<template>
  <PerdCard :class="$style.component">
    <p :class="$style.eyebrow">
      {{ brandName }}
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
    </dl>
  </PerdCard>
</template>

<script lang="ts" setup>
  interface Props {
    brandName: string;
    categoryName: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
    container-type: inline-size;
  }

  .eyebrow {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-label);
  }

  .metadataList {
    display: grid;
    gap: var(--spacing-12);

    @container (inline-size >= 40rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .metadataItem {
    display: grid;
    gap: var(--spacing-8);
    padding: var(--spacing-12);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
    border: 1px solid var(--color-border-subtle);
  }

  .metadataLabel {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-label);
  }

  .metadataValue {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
  }
</style>
