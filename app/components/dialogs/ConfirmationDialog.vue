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
          secondary
          :class="$style.cancelButton"
          @click="close"
        >
          {{ cancelButtonText }}
        </PerdButton>

        <PerdButton
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
    headerText: string;
    confirmButtonText: string;
    cancelButtonText?: string;
  }

  type Emits = (event: 'confirm') => void

  const isOpened = defineModel<boolean>({
    required: true
  })

  const {
    cancelButtonText = 'Cancel'
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
    background-color: var(--color-background);
    padding: var(--spacing-24);
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-background-100);
  }

  .header {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .body {
    word-break: break-word;
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
