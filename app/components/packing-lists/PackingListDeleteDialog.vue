<template>
  <ConfirmationDialog
    v-model="isDialogVisible"
    header-text="Delete packing list"
    confirm-button-text="Delete list"
    confirm-variant="danger"
    :close-on-confirm="false"
    :confirm-disabled="isDisabled"
    :confirm-loading="isDeleting"
    :error="errorMessage"
    @confirm="handleDelete"
  >
    Delete “{{ name }}” and all its list items?
    Items in My gear and the gear library will stay. This cannot be undone.
  </ConfirmationDialog>
</template>

<script lang="ts" setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'

  interface Props {
    available: boolean;
    name: string;
    packingListId: string;
  }

  type Emits = (event: 'deleted') => void

  const { available, packingListId } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isDialogVisible = defineModel<boolean>({ required: true })
  const packingListsStore = usePackingListsStore()
  const errorMessage = ref<string | null>(null)
  const isDeleting = computed(() => packingListsStore.isPackingListDeleting(packingListId))

  const isDisabled = computed(() => !available
    || packingListsStore.isPackingListMutationPending(packingListId))

  let isActive = true

  onBeforeUnmount(() => {
    isActive = false
  })

  watch(isDialogVisible, (isVisible) => {
    if (isVisible) {
      errorMessage.value = null
    }
  })

  async function handleDelete() {
    if (isDisabled.value) {
      return
    }

    errorMessage.value = null

    try {
      const isDeleted = await packingListsStore.deletePackingList(packingListId)

      if (!isActive || !isDeleted) {
        return
      }

      isDialogVisible.value = false

      emit('deleted')
    } catch (error) {
      globalThis.console.error('Failed to delete packing list:', error)

      if (isActive) {
        errorMessage.value = 'Could not delete the list. Try again.'
      }
    }
  }
</script>
