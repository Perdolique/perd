<template>
  <ModalDialog v-model="isOpened">
    <form
      method="dialog"
      :class="$style.content"
      @submit.prevent="handleSubmit"
    >
      <div :class="$style.header">Create new checklist</div>

      <input
        required
        autofocus
        placeholder="Checklist name"
        v-model="checklistName"
        :class="$style.input"
        :maxlength="limits.maxChecklistNameLength"
        type="text"
      />

      <div :class="$style.buttons">
        <PerdButton
          secondary
          type="button"
          @click="handleCancelClick"
        >
          Cancel
        </PerdButton>

        <PerdButton>
          Create
        </PerdButton>
      </div>
    </form>

    <div :class="[$style.loader, { visible: loading }]">
      <CircleSpinner />
    </div>
  </ModalDialog>
</template>

<script lang="ts" setup>
  import { limits } from '~~/constants';
  import PerdButton from '~/components/PerdButton.vue'
  import CircleSpinner from '~/components/CircleSpinner.vue'
  import ModalDialog from './ModalDialog.vue'

  interface Props {
    readonly loading: boolean;
  }

  type Emits = (event: 'submit', checklistName: string) => void

  defineProps<Props>()

  const emit = defineEmits<Emits>()
  const checklistName = ref('')

  const isOpened = defineModel<boolean>({
    required: true
  })

  function handleCancelClick() {
    isOpened.value = false
  }

  function handleSubmit(event: Event) {
    if (checklistName.value !== '') {
      emit('submit', checklistName.value)
    }
  }

  // Reset checklist name when dialog is opened
  watch(isOpened, (value) => {
    if (value) {
      checklistName.value = ''
    }
  })
</script>

<style module>
  .content {
    display: grid;
    row-gap: var(--spacing-24);
    background-color: var(--color-background);
    padding: var(--spacing-16) var(--spacing-32);
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-blue-700);
  }

  .header {
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-medium);
    text-align: center;
  }

  .input {
    text-align: center;
  }

  .input::placeholder {
    user-select: none;
  }

  .buttons {
    display: grid;
    grid-auto-flow: column;
    column-gap: var(--spacing-16);
  }

  .loader {
    display: none;
    opacity: 0;
    position: fixed;
    inset: 0;
    justify-content: center;
    align-items: center;
    background-color: rgb(0 0 0 / 25%);
    border-radius: var(--border-radius-24);
    transition:
      opacity 0.3s ease-out,
      display 0.3s ease-out allow-discrete;

    &:global(.visible) {
      opacity: 1;
      display: flex;

      @starting-style {
        opacity: 0;
      }
    }
  }
</style>
