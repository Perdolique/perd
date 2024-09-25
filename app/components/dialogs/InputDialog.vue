<template>
  <ModalDialog v-model="isOpened">
    <form
      method="dialog"
      :class="$style.content"
      @submit="handleSubmit"
    >
      <div :class="$style.header">
        {{ headerText }}
      </div>

      <input
        required
        autofocus
        v-model="input"
        :placeholder="placeholder"
        :class="$style.input"
        :maxlength="maxlength"
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
          {{ addButtonText }}
        </PerdButton>
      </div>
    </form>
  </ModalDialog>
</template>

<script lang="ts" setup>
  import PerdButton from '~/components/PerdButton.vue'
  import ModalDialog from './ModalDialog.vue'

  interface Props {
    readonly headerText: string
    readonly placeholder: string
    readonly addButtonText: string
    readonly maxlength: number
  }

  type Emits = (event: 'submit', input: string) => void

  defineProps<Props>()

  const emit = defineEmits<Emits>()
  const input = ref('')

  const isOpened = defineModel<boolean>({
    required: true
  })

  function handleCancelClick() {
    isOpened.value = false
  }

  function handleSubmit(event: Event) {
    if (input.value !== '') {
      emit('submit', input.value)
    }
  }

  // Reset form when dialog is opened
  watch(isOpened, (value) => {
    if (value) {
      input.value = ''
    }
  })
</script>

<style module>
  .content {
    display: grid;
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
</style>
