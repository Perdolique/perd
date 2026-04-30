<template>
  <PerdCard :class="$style.component">
    <div :class="$style.header">
      <p :class="$style.eyebrow">
        {{ brandName }}
      </p>

      <PerdPill :tone="statusTone">
        {{ statusText }}
      </PerdPill>
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
  import { computed } from 'vue'
  import PerdPill, { type PerdPillTone } from '~/components/PerdPill.vue'

  interface Props {
    brandName: string;
    categoryName: string;
    statusClass: string;
    statusText: string;
  }

  const props = defineProps<Props>()

  const statusTone = computed<PerdPillTone>(() => {
    if (props.statusClass === 'approved') {
      return 'success'
    }

    if (props.statusClass === 'rejected') {
      return 'danger'
    }

    return 'warning'
  })
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
    container-type: inline-size;
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
    letter-spacing: var(--letter-spacing-label);
  }

  .text {
    color: var(--color-text-tertiary);
  }

  .metadataList {
    display: grid;
    gap: var(--spacing-12);

    @container (inline-size >= 40rem) {
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
    letter-spacing: var(--letter-spacing-label);
  }

  .metadataValue {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
  }
</style>
