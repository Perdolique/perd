<template>
  <div :class="$style.component">
    <p
      v-if="isCreateEntryErrorVisible"
      id="packing-list-entry-create-error"
      :class="$style.errorMessage"
      role="status"
    >
      {{ createEntryErrorMessage }}
    </p>

    <div v-if="isEntryListEmpty" :class="$style.emptyChecklist">
      <span :class="$style.emptyIcon" aria-hidden="true">
        🎒
      </span>

      <p :class="$style.emptyCopy">
        {{ emptyStateCopy }}
      </p>
    </div>

    <ul v-else :class="$style.entryList">
      <li
        v-for="entry in entries"
        :key="entry.id"
        :class="[$style.entryItem, entry.stateClass]"
      >
        <template v-if="isChecklistMode">
          <label :class="$style.entryToggle">
            <input
              type="checkbox"
              :class="$style.entryCheckbox"
              :checked="entry.isPacked"
              :disabled="entry.isDisabled"
              :aria-label="entry.toggleLabel"
              @change="emitToggleEntry(entry)"
            >

            <span :class="$style.entryText">
              <span :class="$style.entryName">
                {{ entry.displayName }}
              </span>

              <span :class="$style.entryMeta">
                {{ entry.detailText }}
              </span>

              <span :class="$style.entryState">
                {{ entry.stateText }}
              </span>
            </span>
          </label>
        </template>

        <template v-else>
          <div :class="$style.entrySummary">
            <span :class="$style.entryName">
              {{ entry.displayName }}
            </span>

            <span :class="$style.entryMeta">
              {{ entry.detailText }}
            </span>

            <span :class="$style.entryState">
              {{ entry.stateText }}
            </span>
          </div>
        </template>

        <PerdButton
          variant="danger"
          size="small"
          icon="hugeicons:delete-02"
          :loading="entry.isLoading"
          :disabled="entry.isDisabled"
          @click="emitDeleteEntry(entry)"
        >
          Remove
        </PerdButton>
      </li>
    </ul>

    <p v-if="isEntryMutationErrorVisible" :class="$style.errorMessage" role="status">
      {{ entryMutationErrorMessage }}
    </p>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { PackingListDetailMode, PackingListEntryView } from '~/types/packing'
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    createEntryErrorMessage: string | null;
    emptyStateCopy: string;
    entries: PackingListEntryView[];
    entryMutationErrorMessage: string | null;
    mode: PackingListDetailMode;
  }

  type Emits = (event: 'deleteEntry' | 'toggleEntry', entry: PackingListEntryView) => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const isChecklistMode = computed(() => props.mode === 'checklist')
  const isCreateEntryErrorVisible = computed(() => props.createEntryErrorMessage !== null)
  const isEntryListEmpty = computed(() => props.entries.length === 0)
  const isEntryMutationErrorVisible = computed(() => props.entryMutationErrorMessage !== null)

  function emitToggleEntry(entry: PackingListEntryView) {
    emit('toggleEntry', entry)
  }

  function emitDeleteEntry(entry: PackingListEntryView) {
    emit('deleteEntry', entry)
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .emptyChecklist {
    display: grid;
    gap: var(--spacing-12);
    justify-items: center;
    padding: var(--spacing-24);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
    text-align: center;
  }

  .emptyIcon {
    font-size: 2.5rem;
    line-height: 1;
  }

  .emptyCopy {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .entryList {
    display: grid;
    gap: var(--spacing-8);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .entryItem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-12);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-12);
    background: var(--color-background-elevated);
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard);

    &:global(.packed) {
      background: color-mix(in oklch, var(--color-success-subtle), var(--color-background-elevated) 58%);
      border-color: color-mix(in oklch, var(--color-success-primary), transparent 72%);
    }

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

  .entrySummary {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .entryToggle {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
    inline-size: 100%;
    min-inline-size: 0;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .entryCheckbox {
    inline-size: 1.15rem;
    block-size: 1.15rem;
    accent-color: var(--color-accent-primary);
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
    }
  }

  .entryText {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .entryName {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;

    .entryItem:global(.packed) & {
      color: var(--color-text-muted);
      text-decoration: line-through;
    }
  }

  .entryMeta {
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    overflow-wrap: anywhere;
  }

  .entryState {
    inline-size: fit-content;
    padding: 0.125rem var(--spacing-8);
    border-radius: var(--border-radius-pill);
    background: var(--color-surface-secondary);
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);

    .entryItem:global(.packed) & {
      background: var(--color-success-subtle);
      color: var(--color-success-primary);
    }
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
    overflow-wrap: anywhere;
  }
</style>
