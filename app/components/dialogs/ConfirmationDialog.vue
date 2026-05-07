<template>
  <ModalDialog v-model="isOpened" :close-disabled="isCloseDisabled">
    <div :class="$style.content">
      <PerdHeading
        :class="$style.header"
        :level="2"
      >
        {{ headerText }}
      </PerdHeading>

      <div :class="$style.body">
        <slot />
      </div>

      <div :class="$style.buttons">
        <PerdButton
          variant="secondary"
          :class="$style.cancelButton"
          :disabled="isCancelDisabled"
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
  import { computed } from 'vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import ModalDialog from './ModalDialog.vue'

  interface Props {
    cancelButtonText?: string;
    closeOnConfirm?: boolean;
    confirmDisabled?: boolean;
    confirmLoading?: boolean;
    confirmVariant?: 'danger' | 'primary';
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
    confirmVariant = 'primary'
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()
  const isCancelDisabled = computed(() => confirmLoading)
  const isCloseDisabled = computed(() => confirmLoading)

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
  .content {
    display: grid;
    row-gap: var(--spacing-24);
    column-gap: var(--spacing-16);
    background:
      linear-gradient(180deg, var(--color-surface-base), var(--color-surface-subtle));
    padding: var(--spacing-24);
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-border-subtle);
    box-shadow: var(--shadow-3);
  }

  .header {
    text-wrap: balance;
  }

  .body {
    overflow-wrap: anywhere;
    color: var(--color-text-tertiary);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--spacing-16);
  }

  .confirmButton,
  .cancelButton {
    max-inline-size: 12.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
