<template>
  <div :class="$style.component">
    <form :class="$style.entryForm" @submit.prevent="emitCreateCustomEntry">
      <div :class="$style.entryField">
        <label :class="$style.inputLabel" for="new-packing-list-entry-name">
          Custom item
        </label>

        <div :class="$style.inputShell">
          <Icon name="hugeicons:add-01" :class="$style.inputIcon" aria-hidden="true" />

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
        icon="hugeicons:add-01"
        :loading="isCreatingCustomEntry"
        :disabled="isCreateCustomEntryDisabled"
      >
        Add custom item
      </PerdButton>
    </form>

    <div :class="$style.myGearSection">
      <div :class="$style.myGearHeader">
        <div>
          <p :class="$style.sectionEyebrow">
            My gear
          </p>

          <h3 :class="$style.sectionTitle">
            Add from my gear
          </h3>
        </div>
      </div>

      <p v-if="isMyGearLoading" :class="$style.helperMessage" role="status">
        Loading my gear.
      </p>

      <p v-else-if="hasMyGearError" :class="$style.errorMessage" role="status">
        Could not load my gear.
      </p>

      <p v-else-if="isMyGearEmpty" :class="$style.helperMessage">
        Save items to my gear first, then add them here.
      </p>

      <p v-else-if="isAvailableMyGearEmpty" :class="$style.helperMessage">
        Every saved item is already in this list.
      </p>

      <ul v-else :class="$style.myGearPickerList">
        <li
          v-for="myGearRow in myGearRows"
          :key="myGearRow.id"
          :class="$style.myGearPickerItem"
        >
          <div :class="$style.myGearPickerText">
            <span :class="$style.myGearPickerName">
              {{ myGearRow.item.name }}
            </span>

            <span :class="$style.myGearPickerMeta">
              {{ myGearRow.item.brand.name }} · {{ myGearRow.item.category.name }}
            </span>
          </div>

          <PerdButton
            size="small"
            variant="secondary"
            icon="hugeicons:add-01"
            :loading="creatingMyGearId === myGearRow.id"
            :disabled="isMyGearActionDisabled"
            @click="emitCreateMyGearEntry(myGearRow.id)"
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
  import type { MyGearRecord } from '~/types/equipment'
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    createEntryDescribedBy?: string;
    creatingMyGearId: string | null;
    hasMyGearError: boolean;
    myGearRows: MyGearRecord[];
    isAnyEntryActionPending: boolean;
    isAvailableMyGearEmpty: boolean;
    isCreateCustomEntryDisabled: boolean;
    isCreatingCustomEntry: boolean;
    isMyGearEmpty: boolean;
    isMyGearLoading: boolean;
  }

  interface Emits {
    (event: 'createCustomEntry'): void;
    (event: 'createMyGearEntry', myGearId: string): void;
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const newEntryName = defineModel<string>({
    required: true
  })

  const isMyGearActionDisabled = computed(() => props.isAnyEntryActionPending)

  function emitCreateCustomEntry() {
    emit('createCustomEntry')
  }

  function emitCreateMyGearEntry(myGearId: string) {
    emit('createMyGearEntry', myGearId)
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

  .myGearSection {
    display: grid;
    gap: var(--spacing-16);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
  }

  .myGearHeader {
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

  .myGearPickerList {
    display: grid;
    gap: var(--spacing-8);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .myGearPickerItem {
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

  .myGearPickerText {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .myGearPickerName {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  .myGearPickerMeta {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    overflow-wrap: anywhere;
  }
</style>
