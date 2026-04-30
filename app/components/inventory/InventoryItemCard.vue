<template>
  <PerdCard :class="$style.component">
    <div :class="$style.header">
      <div :class="$style.info">
        <div :class="$style.titleRow">
          <span :class="$style.icon" aria-hidden="true">
            <Icon name="tabler:backpack" />
          </span>

          <div :class="$style.titleBlock">
            <p :class="$style.brand">
              {{ inventoryRow.item.brand.name }}
            </p>

            <PerdLink :to="inventoryRow.catalogPath">
              {{ inventoryRow.item.name }}
            </PerdLink>
          </div>
        </div>

        <div :class="$style.tags">
          <PerdPill>
            {{ inventoryRow.item.brand.name }}
          </PerdPill>

          <PerdPill>
            {{ inventoryRow.item.category.name }}
          </PerdPill>
        </div>
      </div>

      <div :class="$style.actions">
        <p :class="$style.meta">
          Added <time :datetime="inventoryRow.createdAt">{{ inventoryRow.formattedCreatedAt }}</time>
        </p>

        <PerdButton
          size="small"
          variant="danger"
          icon="tabler:trash"
          :loading="inventoryRow.isRemoving"
          :disabled="inventoryRow.isRemoveDisabled"
          @click="emitRemove"
        >
          Remove
        </PerdButton>
      </div>
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import type { InventoryRecordView } from '~/types/equipment'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PerdPill from '~/components/PerdPill.vue'

  interface Props {
    inventoryRow: InventoryRecordView;
  }

  type Emits = (event: 'remove', inventoryId: string) => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  function emitRemove() {
    emit('remove', props.inventoryRow.id)
  }
</script>

<style module>
  .component {
    display: grid;
    container-type: inline-size;
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-accent-base), transparent 94%),
        var(--color-surface-base)
      );
  }

  .header {
    display: grid;
    gap: var(--spacing-16);

    @container (inline-size >= 40rem) {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }
  }

  .info {
    display: grid;
    gap: var(--spacing-8);
  }

  .titleRow {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
  }

  .titleBlock {
    min-inline-size: 0;
    display: grid;
    gap: 0.12rem;
  }

  .brand {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--border-radius-16);
    background-color: var(--color-accent-subtle);
    color: var(--color-accent-base);
    font-size: 1.1rem;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);
  }

  .actions {
    display: grid;
    gap: var(--spacing-12);
    align-items: start;
    justify-items: start;

    @container (inline-size >= 40rem) {
      justify-items: end;
      text-align: right;
    }
  }

  .meta {
    margin: 0;
    color: var(--color-text-tertiary);
  }
</style>
