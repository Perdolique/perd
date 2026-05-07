<template>
  <ModalDialog
    v-model="isOpened"
    :close-disabled="isCloseDisabled"
    aria-labelledby="new-pack-dialog-title"
  >
    <form :class="$style.component" @submit.prevent="handleSubmit">
      <div :class="$style.header">
        <div :class="$style.headingBlock">
          <p :class="$style.kicker">
            New pack
          </p>

          <PerdHeading
            id="new-pack-dialog-title"
            :class="$style.heading"
            :level="2"
          >
            Create a pack
          </PerdHeading>
        </div>

        <button
          type="button"
          :class="$style.closeButton"
          :disabled="isCloseButtonDisabled"
          aria-label="Close new pack dialog"
          @click="close"
        >
          <Icon name="tabler:x" aria-hidden="true" />
        </button>
      </div>

      <div :class="$style.field">
        <label :class="$style.inputLabel" for="new-packing-list-name">
          Pack name
        </label>

        <div :class="$style.inputShell">
          <Icon name="tabler:route" :class="$style.inputIcon" aria-hidden="true" />

          <input
            id="new-packing-list-name"
            ref="nameInput"
            v-model="packName"
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
        id="new-pack-create-error"
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
          icon="tabler:plus"
          :loading="loading"
          :disabled="isCreateDisabled"
        >
          Create pack
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
  const packName = defineModel<string>('name', {
    required: true
  })
  const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

  const errorMessageId = computed(() => errorMessage === null ? undefined : 'new-pack-create-error')
  const isCloseButtonDisabled = computed(() => loading)
  const isCloseDisabled = computed(() => loading)
  const isCreateDisabled = computed(() => packName.value.trim() === '' || loading)
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
      linear-gradient(180deg, var(--color-surface-base), var(--color-surface-subtle));
    box-shadow: var(--shadow-3);
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

  .kicker,
  .errorMessage {
    margin: 0;
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
    background: var(--color-surface-base);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    outline: 2px solid transparent;
    outline-offset: 3px;
    transition:
      background-color var(--transition-duration-quick) var(--transition-easing-out),
      border-color var(--transition-duration-quick) var(--transition-easing-out),
      color var(--transition-duration-quick) var(--transition-easing-out);

    &:hover {
      border-color: var(--color-border-default);
      background: var(--color-surface-subtle);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      border-color: var(--color-border-default);
      color: var(--color-text-primary);
      outline-color: var(--color-accent-ring);
    }

    &:disabled,
    &:disabled:hover {
      border-color: transparent;
      background: var(--color-surface-subtle);
      color: var(--color-text-muted);
      cursor: not-allowed;
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
    border: 1px solid var(--color-border-default);
    border-radius: var(--border-radius-12);
    background: var(--color-background-raised);
    color: var(--color-text-primary);
    transition:
      border-color var(--transition-duration-quick) var(--transition-easing-out),
      box-shadow var(--transition-duration-quick) var(--transition-easing-out);

    &:focus-within {
      border-color: var(--color-accent-base);
      box-shadow: 0 0 0 3px var(--color-accent-ring);
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
    color: var(--color-danger);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--spacing-12);
  }
</style>
