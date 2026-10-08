<template>
  <div :class="$style.component" @toggle.capture="handleMenuToggle">
    <PerdActionMenu
      v-if="available"
      ref="menu"
      :label="actionLabel"
      trigger-text="Actions"
      menu-label="Packing list actions"
      :items="items"
      :disabled="isBusy"
      :loading="isBusy"
      @action="handleAction"
    />

    <PackingListCopyDialog
      v-if="isCopyVisible"
      v-model="isCopyVisible"
      :available="available"
      :name="name"
      :packing-list-id="packingListId"
      :refresh-original="refreshOriginal"
      @copied="emit('copied', $event)"
    />
    <PackingListRenameDialog
      v-model="isRenameVisible"
      :available="available"
      :name="name"
      :packing-list-id="packingListId"
      @renamed="(savedName, updatedAt) => emit('renamed', savedName, updatedAt)"
    />
    <PackingListClearPackedDialog
      v-model="isClearPackedVisible"
      :available="available"
      :name="name"
      :packing-list-id="packingListId"
      @cleared="emit('cleared', $event)"
      @refreshed="emit('refreshed', $event)"
    />
    <PackingListDeleteDialog
      v-model="isDeleteVisible"
      :available="available"
      :name="name"
      :packing-list-id="packingListId"
      @deleted="emit('deleted')"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
  import type { PackingListDetail } from '~/types/packing'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import PerdActionMenu, { type ActionMenuItem } from '~/components/PerdActionMenu.vue'
  import PackingListCopyDialog from '~/components/packing-lists/PackingListCopyDialog.vue'
  import PackingListRenameDialog from '~/components/packing-lists/PackingListRenameDialog.vue'
  import PackingListClearPackedDialog from '~/components/packing-lists/PackingListClearPackedDialog.vue'
  import PackingListDeleteDialog from '~/components/packing-lists/PackingListDeleteDialog.vue'

  interface Props {
    available: boolean;
    name: string;
    packingListId: string;
    refreshOriginal: (signal: AbortSignal) => Promise<void>;
  }

  interface Emits {
    cleared: [list: PackingListDetail];
    refreshed: [list: PackingListDetail];
    copied: [id: string];
    deleted: [];
    renamed: [name: string, updatedAt: string];
  }

  const { available, name, packingListId } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const store = usePackingListsStore()
  const menu = useTemplateRef('menu')
  const isCopyVisible = ref(false)
  const isRenameVisible = ref(false)
  const isClearPackedVisible = ref(false)
  const isDeleteVisible = ref(false)
  const actionLabel = computed(() => `Actions for ${name}`)

  const isBusy = computed(() => store.isPackingListCopying(packingListId)
    || store.isPackingListRenaming(packingListId)
    || store.isPackingListDeleting(packingListId)
    || store.isPackingListClearingPacked(packingListId)
    || store.isPackingListRefreshingPacked(packingListId))

  const items = computed<ActionMenuItem[]>(() => {
    const isUnconfirmed = store.isPackingListPackedUnconfirmed(packingListId)
    const isSnapshotDisabled = !available || store.isPackingListMutationPending(packingListId) || isUnconfirmed
    const canClearPacked = store.canClearPackingListPacked(packingListId)
    let clearHint = 'There are no packed marks to clear.'

    if (isUnconfirmed) {
      clearHint = 'Refresh the list to confirm its packed marks.'
    } else if (store.isPackingListMutationPending(packingListId)) {
      clearHint = 'Wait for list changes to finish saving.'
    }

    return [{
      id: 'copy',
      label: 'Copy list',
      icon: 'hugeicons:copy-01',
      disabled: isSnapshotDisabled
    }, {
      id: 'rename',
      label: 'Rename',
      icon: 'hugeicons:pencil-edit-02',
      disabled: !available || isUnconfirmed
    }, {
      id: 'clear-packed',
      label: 'Clear packed marks',
      icon: 'hugeicons:refresh',
      disabled: !available || !canClearPacked,
      hint: canClearPacked ? undefined : clearHint
    }, {
      id: 'delete',
      label: 'Delete',
      icon: 'hugeicons:delete-02',
      disabled: isSnapshotDisabled,
      danger: true,
      separator: true
    }]
  })

  watch([isCopyVisible, isRenameVisible, isClearPackedVisible, isDeleteVisible], async (visible, previous) => {
    const wasVisible = previous.some(Boolean)
    const isVisible = visible.some(Boolean)

    if (wasVisible && !isVisible) {
      await nextTick()
      menu.value?.focus()
    }
  })

  function focus() {
    menu.value?.focus()
  }

  defineExpose({ focus })

  function handleMenuToggle(event: Event) {
    const { target } = event

    if (!(event instanceof globalThis.ToggleEvent) || event.newState !== 'closed') {
      return
    }

    if (!(target instanceof globalThis.HTMLElement) || target.getAttribute('role') !== 'menu') {
      return
    }

    const isDialogVisible = isCopyVisible.value || isRenameVisible.value || isClearPackedVisible.value || isDeleteVisible.value

    if (!isDialogVisible) {
      menu.value?.focus()
    }
  }

  function handleAction(id: string) {
    if (!available || isBusy.value || store.isPackingListPackedUnconfirmed(packingListId)) {
      return
    }

    if (id === 'clear-packed' && store.canClearPackingListPacked(packingListId)) {
      isClearPackedVisible.value = true
    } else if (id === 'rename') {
      isRenameVisible.value = true
    } else if (!store.isPackingListMutationPending(packingListId)) {
      if (id === 'copy') {
        isCopyVisible.value = true
      } else if (id === 'delete') {
        isDeleteVisible.value = true
      }
    }
  }
</script>

<style module>
  .component {
    display: contents;
  }
</style>
