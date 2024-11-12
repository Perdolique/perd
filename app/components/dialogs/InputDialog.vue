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

      <TextInput
        required
        autofocus
        ref="textInputRef"
        v-model="input"
        :placeholder="placeholder"
        :class="$style.input"
        :maxlength="maxlength"
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
  import TextInput from '~/components/TextInput.vue';
  import ModalDialog from './ModalDialog.vue'

  interface Props {
    readonly headerText: string;
    readonly placeholder: string;
    readonly addButtonText: string;
    readonly maxlength: number;
    readonly initialValue?: string;
  }

  type Emits = (event: 'submit', input: string) => void

  const { initialValue = '' } = defineProps<Props>()
  const textInputRef = useTemplateRef('textInputRef')
  const emit = defineEmits<Emits>()
  const input = ref(initialValue)

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
  watch(isOpened, (opened) => {
    if (opened) {
      // Reset input field to initial value
      if (input.value !== initialValue) {
        input.value = initialValue
      }

      // Select text in input field if it's not empty
      if (input.value !== '') {
        textInputRef.value?.$el.select()
      }
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

  .buttons {
    display: grid;
    grid-auto-flow: column;
    column-gap: var(--spacing-16);
  }
</style>
