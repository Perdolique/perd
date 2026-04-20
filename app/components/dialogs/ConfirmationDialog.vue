<template>
  <ModalDialog v-model="isOpened">
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
          @click="close"
        >
          {{ cancelButtonText }}
        </PerdButton>

        <PerdButton
          :variant="confirmVariant"
          :class="$style.confirmButton"
          @click="emitConfirm"
        >
          {{ confirmButtonText }}
        </PerdButton>
      </div>
    </div>
  </ModalDialog>
</template>

<script lang="ts" setup>
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue';
  import ModalDialog from './ModalDialog.vue'

  interface Props {
    cancelButtonText?: string;
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
    confirmVariant = 'primary'
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()

  function close() {
    isOpened.value = false
  }

  function emitConfirm() {
    emit('confirm')

    close()
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
    word-break: break-word;
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
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
