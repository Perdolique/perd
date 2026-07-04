<template>
  <PerdCard :class="$style.component">
    <div :class="$style.header">
      <div :class="$style.info">
        <div :class="$style.titleRow">
          <span :class="$style.icon" aria-hidden="true">
            <Icon name="hugeicons:backpack-03" />
          </span>

          <div :class="$style.titleBlock">
            <p :class="$style.brand">
              {{ myGearRow.item.brand.name }}
            </p>

            <PerdLink :to="myGearRow.gearLibraryPath">
              {{ myGearRow.item.name }}
            </PerdLink>
          </div>
        </div>

        <div :class="$style.tags">
          <PerdPill>
            {{ myGearRow.item.brand.name }}
          </PerdPill>

          <PerdPill>
            {{ myGearRow.item.category.name }}
          </PerdPill>
        </div>
      </div>

      <div :class="$style.actions">
        <p :class="$style.meta">
          Added <time :datetime="myGearRow.createdAt">{{ myGearRow.formattedCreatedAt }}</time>
        </p>

        <PerdButton
          size="small"
          variant="danger"
          icon="hugeicons:delete-02"
          :loading="myGearRow.isRemoving"
          :disabled="myGearRow.isRemoveDisabled"
          @click="emitRemove"
        >
          Remove
        </PerdButton>
      </div>
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import type { MyGearRecordView } from '~/types/equipment'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PerdPill from '~/components/PerdPill.vue'

  interface Props {
    myGearRow: MyGearRecordView;
  }

  type Emits = (event: 'remove', myGearId: string) => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  function emitRemove() {
    emit('remove', props.myGearRow.id)
  }
</script>

<style module>
  .component {
    display: grid;
    container-type: inline-size;
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-accent-primary), transparent 94%),
        var(--color-surface-primary)
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
    color: var(--color-accent-primary);
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
