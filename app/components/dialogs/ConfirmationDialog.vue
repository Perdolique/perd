<template>
  <ModalDialog
    v-model="isOpened"
    :class="$style.dialog"
    :aria-labelledby="headingId"
    :close-disabled="confirmLoading"
  >
    <div :class="$style.content">
      <PerdHeading
        :id="headingId"
        :class="$style.header"
        :level="2"
      >
        {{ headerText }}
      </PerdHeading>

      <div :class="$style.body">
        <slot />
      </div>

      <p v-if="hasError" :class="$style.error" role="alert">
        {{ error }}
      </p>

      <div :class="$style.buttons">
        <PerdButton
          variant="secondary"
          :class="$style.cancelButton"
          :disabled="confirmLoading"
          @click="close"
        >
          {{ cancelButtonText }}
        </PerdButton>

        <PerdButton
          :variant="confirmVariant"
          :class="$style.confirmButton"
          :loading="confirmLoading"
          :disabled="confirmDisabled"
          @click="emitConfirm"
        >
          {{ confirmButtonText }}
        </PerdButton>
      </div>
    </div>
  </ModalDialog>
</template>

<script lang="ts" setup>
  import { computed, useId } from 'vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import ModalDialog from './ModalDialog.vue'

  interface Props {
    cancelButtonText?: string;
    closeOnConfirm?: boolean;
    confirmDisabled?: boolean;
    confirmLoading?: boolean;
    confirmVariant?: 'danger' | 'primary';
    error?: string | null;
    headerText: string;
    confirmButtonText: string;
  }

  type Emits = (event: 'confirm') => void

  const isOpened = defineModel<boolean>({
    required: true
  })

  const {
    cancelButtonText = 'Cancel',
    closeOnConfirm = true,
    confirmDisabled = false,
    confirmLoading = false,
    confirmVariant = 'primary',
    error = null
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()
  const headingId = useId()
  const hasError = computed(() => error !== null)

  function close() {
    if (confirmLoading) {
      return
    }

    isOpened.value = false
  }

  function emitConfirm() {
    emit('confirm')

    if (closeOnConfirm) {
      close()
    }
  }
</script>

<style module>
  .dialog {
    inline-size: min(100dvw - var(--spacing-32), 30rem);
    max-inline-size: none;
  }

  .content {
    display: grid;
    row-gap: var(--spacing-24);
    column-gap: var(--spacing-16);
    background:
      linear-gradient(180deg, var(--color-surface-primary), var(--color-surface-secondary));
    padding: var(--spacing-24);
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-border-subtle);
    box-shadow: var(--shadow-large);
  }

  .header {
    text-wrap: balance;
  }

  .body {
    overflow-wrap: anywhere;
    color: var(--color-text-tertiary);
  }

  .error {
    color: var(--color-danger-primary);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--spacing-16);
  }

  .confirmButton {
    max-inline-size: 12.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cancelButton {
    max-inline-size: 12.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
