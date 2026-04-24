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
          <p :class="$style.tag">
            {{ inventoryRow.item.brand.name }}
          </p>

          <p :class="$style.tag">
            {{ inventoryRow.item.category.name }}
          </p>
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

    @media (width >= 640px) {
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
    min-width: 0;
    display: grid;
    gap: 0.12rem;
  }

  .brand {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
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

  .tag {
    margin: 0;
    padding: var(--spacing-4) var(--spacing-12);
    border-radius: 999px;
    background-color: var(--color-surface-subtle);
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    border: 1px solid var(--color-border-subtle);
  }

  .actions {
    display: grid;
    gap: var(--spacing-12);
    align-items: start;
    justify-items: start;

    @media (width >= 640px) {
      justify-items: end;
      text-align: right;
    }
  }

  .meta {
    margin: 0;
    color: var(--color-text-tertiary);
  }
</style>
