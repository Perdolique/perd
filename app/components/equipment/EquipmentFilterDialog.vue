<template>
  <ModalDialog v-model="isOpened">
    <form
      method="dialog"
      :class="$style.content"
      @submit="handleSubmit"
    >
      <div :class="$style.header">
        Equipment filters
      </div>

      <div :class="$style.inputs">
        <SearchInput v-model="searchModel" />
      </div>

      <div :class="$style.buttons">
        <PerdButton
          secondary
          type="button"
          @click="handleCancelClick"
        >
          Cancel
        </PerdButton>

        <PerdButton>
          Apply filters
        </PerdButton>
      </div>
    </form>
  </ModalDialog>
</template>

<script lang="ts" setup>
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import PerdButton from '~/components/PerdButton.vue';
  import SearchInput from './SearchInput.vue';

  type Emits = (event: 'submit') => void

  const emit = defineEmits<Emits>()

  const searchModel = defineModel<string>('search', {
    required: true
  })

  const isOpened = defineModel<boolean>({
    required: true
  })

  function handleCancelClick() {
    isOpened.value = false
  }

  function handleSubmit() {
    emit('submit')
  }
</script>

<style module>
  .content {
    display: grid;
    width: 300px;
    row-gap: var(--spacing-24);
    background-color: var(--dialog-color-background);
    padding: var(--dialog-padding);
    border-radius: var(--dialog-border-radius);
    border: 1px solid var(--dialog-color-border);
  }

  .header {
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-medium);
    text-align: center;
  }

  .inputs {
    display: grid;
    row-gap: var(--spacing-12);
  }

  .buttons {
    display: grid;
    grid-auto-flow: column;
    column-gap: var(--spacing-16);
  }
</style>
