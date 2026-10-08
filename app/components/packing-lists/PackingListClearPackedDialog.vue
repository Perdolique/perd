<template>
  <ConfirmationDialog
    ref="dialog"
    v-model="isDialogVisible"
    header-text="Clear packed marks"
    confirm-button-text="Clear packed marks"
    :close-on-confirm="false"
    :confirm-disabled="isConfirmDisabled"
    :confirm-loading="isBusy"
    :error="errorMessage"
    @confirm="handleClear"
  >
    <div :class="$style.component">
      <p>Clear all packed marks in “{{ name }}”? Items and saved gear will not be removed.</p>
      <PerdButton
        v-if="isUnconfirmed"
        ref="refreshButton"
        variant="secondary"
        :loading="isRefreshing"
        @click="handleRefresh"
      >Refresh list</PerdButton>
    </div>
  </ConfirmationDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
  import type { PackingListDetail } from '~/types/packing'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    available: boolean;
    name: string;
    packingListId: string;
  }

  interface Emits {
    refreshed: [list: PackingListDetail];
    cleared: [list: PackingListDetail];
  }

  const { available, packingListId } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isDialogVisible = defineModel<boolean>({ required: true })
  const store = usePackingListsStore()
  const dialog = useTemplateRef('dialog')
  const refreshButton = useTemplateRef('refreshButton')
  const errorMessage = ref<string | null>(null)
  const isClearing = computed(() => store.isPackingListClearingPacked(packingListId))
  const isRefreshing = computed(() => store.isPackingListRefreshingPacked(packingListId))
  const isUnconfirmed = computed(() => store.isPackingListPackedUnconfirmed(packingListId))
  const isBusy = computed(() => isClearing.value || isRefreshing.value)
  const isConfirmDisabled = computed(() => !available || !store.canClearPackingListPacked(packingListId))
  let isActive = true

  onBeforeUnmount(() => {
    isActive = false
  })

  watch(isDialogVisible, async (visible) => {
    if (visible) {
      errorMessage.value = null

      await nextTick()
      dialog.value?.focusConfirm()
    }
  })

  async function focusNextAction() {
    await nextTick()

    if (!isActive || !isDialogVisible.value) {
      return
    }

    if (isUnconfirmed.value) {
      refreshButton.value?.focus()
    } else if (isConfirmDisabled.value) {
      dialog.value?.focusCancel()
    } else {
      dialog.value?.focusConfirm()
    }
  }

  async function handleClear() {
    if (!isDialogVisible.value || isConfirmDisabled.value) {
      return
    }

    errorMessage.value = null

    try {
      const saved = await store.clearPackingListPacked(packingListId)

      if (!isActive || saved === null) {
        return
      }

      emit('cleared', saved)

      isDialogVisible.value = false
    } catch {
      if (!isActive) {
        return
      }

      errorMessage.value = isUnconfirmed.value
        ? 'Could not confirm the packed marks. The list may be out of date. Refresh the list before trying again.'
        : 'Could not confirm the reset. The list has been refreshed. Check its packed marks before trying again.'

      await focusNextAction()
    }
  }

  async function handleRefresh() {
    if (isBusy.value) {
      return
    }

    try {
      const refreshed = await store.refreshPackingListPacked(packingListId)

      if (!isActive || refreshed === null) {
        return
      }

      emit('refreshed', refreshed)

      errorMessage.value = null

      await focusNextAction()
    } catch {
      if (isActive) {
        errorMessage.value = 'Could not refresh the list. Its packed marks are still unconfirmed. Try refreshing again.'

        await focusNextAction()
      }
    }
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-16);
  }
</style>
