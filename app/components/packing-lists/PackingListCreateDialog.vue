<template>
  <ModalDialog
    v-model="isOpened"
    :close-disabled="loading"
    aria-labelledby="new-packing-list-dialog-title"
  >
    <form :class="$style.component" @submit.prevent="handleSubmit">
      <div :class="$style.header">
        <div :class="$style.headingBlock">
          <div :class="$style.kicker">
            New list
          </div>

          <PerdHeading
            id="new-packing-list-dialog-title"
            :class="$style.heading"
            :level="2"
          >
            Create a packing list
          </PerdHeading>
        </div>

        <button
          type="button"
          :class="$style.closeButton"
          :disabled="loading"
          aria-label="Close new list dialog"
          @click="close"
        >
          <Icon name="hugeicons:cancel-01" aria-hidden="true" />
        </button>
      </div>

      <div :class="$style.field">
        <label :class="$style.inputLabel" for="new-packing-list-name">
          List name
        </label>

        <div :class="$style.inputShell">
          <Icon name="hugeicons:check-list" :class="$style.inputIcon" aria-hidden="true" />

          <input
            id="new-packing-list-name"
            ref="nameInput"
            v-model="listName"
            :disabled="loading"
            :aria-describedby="errorMessageId"
            :class="$style.input"
            name="name"
            autocomplete="off"
            placeholder="Alpine weekend"
          >
        </div>
      </div>

      <p
        v-if="isErrorVisible"
        id="new-packing-list-create-error"
        :class="$style.errorMessage"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <div :class="$style.actions">
        <PerdButton
          variant="secondary"
          :disabled="loading"
          @click="close"
        >
          Cancel
        </PerdButton>

        <PerdButton
          type="submit"
          icon="hugeicons:add-01"
          :loading="loading"
          :disabled="isCreateDisabled"
        >
          Create list
        </PerdButton>
      </div>
    </form>
  </ModalDialog>
</template>

<script lang="ts" setup>
  import { computed, nextTick, useTemplateRef, watch } from 'vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'

  interface Props {
    errorMessage?: string | null;
    loading?: boolean;
  }

  type Emits = (event: 'create') => void

  const {
    errorMessage = null,
    loading = false
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()
  const isOpened = defineModel<boolean>({
    required: true
  })
  const listName = defineModel<string>('name', {
    required: true
  })
  const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

  const errorMessageId = computed(() => errorMessage === null ? undefined : 'new-packing-list-create-error')
  const isCreateDisabled = computed(() => listName.value.trim() === '' || loading)
  const isErrorVisible = computed(() => errorMessage !== null)

  watch(isOpened, async (opened) => {
    if (opened === false) {
      return
    }

    await nextTick()
    nameInput.value?.focus()
  })

  function close() {
    if (loading) {
      return
    }

    isOpened.value = false
  }

  function handleSubmit() {
    if (isCreateDisabled.value) {
      return
    }

    emit('create')
  }
</script>

<style module>
  .component {
    display: grid;
    inline-size: min(100vw - var(--spacing-32), 30rem);
    row-gap: var(--spacing-24);
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-24);
    background:
      linear-gradient(180deg, var(--color-surface-primary), var(--color-surface-secondary));
    box-shadow: var(--shadow-large);
  }

  .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--spacing-16);
  }

  .headingBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .kicker {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .heading {
    text-wrap: balance;
  }

  .closeButton {
    appearance: none;
    display: inline-grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    padding: 0;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-12);
    background: var(--color-surface-primary);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover {
      border-color: var(--color-border-strong);
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      border-color: var(--color-border-strong);
      color: var(--color-text-primary);
      box-shadow: var(--shadow-focus);
    }

    &:disabled {
      border-color: transparent;
      background: var(--color-surface-secondary);
      color: var(--color-text-muted);
      cursor: not-allowed;

      &:hover {
        border-color: transparent;
        background: var(--color-surface-secondary);
        color: var(--color-text-muted);
        cursor: not-allowed;
      }
    }
  }

  .field {
    display: grid;
    gap: var(--spacing-8);
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

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--spacing-12);
  }
</style>
