<template>
  <div :class="$style.component">
    <form :class="$style.entryForm" @submit.prevent="emitCreateCustomEntry">
      <div :class="$style.entryField">
        <label :class="$style.inputLabel" for="new-packing-list-entry-name">
          Custom item
        </label>

        <div :class="$style.inputShell">
          <Icon name="tabler:plus" :class="$style.inputIcon" aria-hidden="true" />

          <input
            id="new-packing-list-entry-name"
            v-model="newEntryName"
            :disabled="isAnyEntryActionPending"
            :aria-describedby="createEntryDescribedBy"
            :class="$style.input"
            name="customName"
            autocomplete="off"
            placeholder="Rain jacket"
          >
        </div>
      </div>

      <PerdButton
        type="submit"
        icon="tabler:plus"
        :loading="isCreatingCustomEntry"
        :disabled="isCreateCustomEntryDisabled"
      >
        Add custom item
      </PerdButton>
    </form>

    <div :class="$style.inventorySection">
      <div :class="$style.inventoryHeader">
        <div>
          <p :class="$style.sectionEyebrow">
            Saved gear
          </p>

          <h3 :class="$style.sectionTitle">
            Add from inventory
          </h3>
        </div>
      </div>

      <p v-if="isInventoryLoading" :class="$style.helperMessage" role="status">
        Loading gear.
      </p>

      <p v-else-if="hasInventoryError" :class="$style.errorMessage" role="status">
        Could not load gear.
      </p>

      <p v-else-if="isInventoryEmpty" :class="$style.helperMessage">
        Save gear in your inventory first, then add it here.
      </p>

      <p v-else-if="isAvailableInventoryEmpty" :class="$style.helperMessage">
        Every saved item is already in this pack.
      </p>

      <ul v-else :class="$style.inventoryPickerList">
        <li
          v-for="inventoryRow in inventoryRows"
          :key="inventoryRow.id"
          :class="$style.inventoryPickerItem"
        >
          <div :class="$style.inventoryPickerText">
            <span :class="$style.inventoryPickerName">
              {{ inventoryRow.item.name }}
            </span>

            <span :class="$style.inventoryPickerMeta">
              {{ inventoryRow.item.brand.name }} · {{ inventoryRow.item.category.name }}
            </span>
          </div>

          <PerdButton
            size="small"
            variant="secondary"
            icon="tabler:plus"
            :loading="creatingInventoryId === inventoryRow.id"
            :disabled="isInventoryActionDisabled"
            @click="emitCreateInventoryEntry(inventoryRow.id)"
          >
            Add
          </PerdButton>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { InventoryRecord } from '~/types/equipment'
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    createEntryDescribedBy?: string;
    creatingInventoryId: string | null;
    hasInventoryError: boolean;
    inventoryRows: InventoryRecord[];
    isAnyEntryActionPending: boolean;
    isAvailableInventoryEmpty: boolean;
    isCreateCustomEntryDisabled: boolean;
    isCreatingCustomEntry: boolean;
    isInventoryEmpty: boolean;
    isInventoryLoading: boolean;
  }

  interface Emits {
    (event: 'createCustomEntry'): void;
    (event: 'createInventoryEntry', inventoryId: string): void;
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const newEntryName = defineModel<string>({
    required: true
  })

  const isInventoryActionDisabled = computed(() => props.isAnyEntryActionPending)

  function emitCreateCustomEntry() {
    emit('createCustomEntry')
  }

  function emitCreateInventoryEntry(inventoryId: string) {
    emit('createInventoryEntry', inventoryId)
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .entryForm {
    display: grid;
    gap: var(--spacing-12);
    align-items: end;
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background:
      linear-gradient(
        145deg,
        var(--color-surface-secondary),
        color-mix(in oklch, var(--color-accent-subtle), transparent 72%)
      );

    @container (inline-size >= 42rem) {
      grid-template-columns: minmax(0, 1fr) auto;
    }
  }

  .entryField {
    display: grid;
    gap: var(--spacing-8);
    min-inline-size: 0;
  }

  .inputLabel {
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
  }

  .inputShell {
    display: flex;
    align-items: center;
    gap: var(--spacing-8);
    min-block-size: 2.75rem;
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background: var(--color-background-elevated);
    color: var(--color-text-primary);
    transition:
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:focus-within {
      border-color: var(--color-accent-primary);
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }
  }

  .inputIcon {
    flex-shrink: 0;
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .input {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    outline: 0;

    &::placeholder {
      color: var(--color-text-muted);
    }

    &:disabled {
      color: var(--color-text-muted);
    }
  }

  .inventorySection {
    display: grid;
    gap: var(--spacing-16);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
  }

  .inventoryHeader {
    display: grid;
    gap: var(--spacing-8);
  }

  .sectionEyebrow {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    text-transform: uppercase;
  }

  .sectionTitle {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-16);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
  }

  .helperMessage {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
    overflow-wrap: anywhere;
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
    overflow-wrap: anywhere;
  }

  .inventoryPickerList {
    display: grid;
    gap: var(--spacing-8);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .inventoryPickerItem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background: var(--color-background-elevated);

    & > :last-child {
      justify-self: end;
    }

    @container (inline-size < 34rem) {
      grid-template-columns: minmax(0, 1fr);

      & > :last-child {
        justify-self: stretch;
      }
    }
  }

  .inventoryPickerText {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .inventoryPickerName {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  .inventoryPickerMeta {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    overflow-wrap: anywhere;
  }
</style>
