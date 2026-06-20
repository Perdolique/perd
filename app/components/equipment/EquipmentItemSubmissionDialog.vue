<template>
  <ModalDialog
    v-model="isOpened"
    :close-disabled="isSubmitting"
    aria-labelledby="gear-submission-dialog-title"
    overlay-close-disabled
  >
    <EquipmentItemSubmissionForm
      form-id="equipment-submission"
      heading-id="gear-submission-dialog-title"
      :active="isOpened"
      show-cancel-button
      show-close-button
      show-full-page-link
      show-header
      submit-label="Create now"
      variant="dialog"
      @close="close"
      @submitted="handleSubmitted"
      @submitting="handleSubmitting"
    />
  </ModalDialog>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'
  import type { ItemSubmissionCreateResponse } from '~/types/equipment'
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import EquipmentItemSubmissionForm from '~/components/equipment/EquipmentItemSubmissionForm.vue'

  type Emits = (event: 'submitted', response: ItemSubmissionCreateResponse) => void

  const emit = defineEmits<Emits>()
  const isOpened = defineModel<boolean>({
    required: true
  })
  const isSubmitting = ref(false)

  function close() {
    isOpened.value = false
  }

  function handleSubmitted(response: ItemSubmissionCreateResponse) {
    emit('submitted', response)
    close()
  }

  function handleSubmitting(submitting: boolean) {
    isSubmitting.value = submitting
  }
</script>
