<template>
  <ConfirmationDialog
    v-model="isOpened"
    :header-text="headerText"
    confirm-button-text="Delete list"
    confirm-variant="danger"
    :confirm-loading="loading"
    :confirm-disabled="loading"
    :close-on-confirm="false"
    @confirm="emitConfirm"
  >
    <div :class="$style.component">
      <p :class="$style.copy">
        This will permanently delete the list and return you to the packing lists page.
      </p>

      <p v-if="errorMessage" :class="$style.errorMessage" role="status">
        {{ errorMessage }}
      </p>
    </div>
  </ConfirmationDialog>
</template>

<script lang="ts" setup>
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'

  interface Props {
    errorMessage: string | null;
    headerText: string;
    loading: boolean;
  }

  type Emits = (event: 'confirm') => void

  defineProps<Props>()

  const emit = defineEmits<Emits>()
  const isOpened = defineModel<boolean>({
    required: true
  })

  function emitConfirm() {
    emit('confirm')
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-12);
  }

  .copy {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
    overflow-wrap: anywhere;
  }
</style>
