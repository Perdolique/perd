<template>
  <div :class="$style.component">
    <ConfirmationDialog
      v-model="isDialogVisible"
      header-text="Rename packing list"
      confirm-button-text="Save name"
      :close-on-confirm="false"
      :confirm-disabled="isConfirmDisabled"
      :confirm-loading="isRenaming"
      :error="errorMessage"
      @confirm="handleRename"
    >
      <form v-if="isDialogVisible" novalidate @submit.prevent="handleRename">
        <TextInput
          ref="nameInput"
          v-model="editedName"
          name="packing-list-name"
          label="List name"
          :disabled="isRenaming"
          :error="nameErrorMessage"
          required
        />
      </form>
    </ConfirmationDialog>

    <p :class="$style.announcement" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </div>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
  import * as v from 'valibot'
  import { limits } from '#shared/constants'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import TextInput from '~/components/TextInput.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'

  interface Props {
    available: boolean;
    name: string;
    packingListId: string;
  }

  interface Emits {
    renamed: [name: string, updatedAt: string];
  }

  const { available, name, packingListId } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isDialogVisible = defineModel<boolean>({ required: true })
  const packingListsStore = usePackingListsStore()
  const nameInput = useTemplateRef('nameInput')
  const editedName = ref('')
  const nameErrorMessage = ref<string>()
  const errorMessage = ref<string | null>(null)
  const announcement = ref('')
  const nameLengthMessage = `Use ${limits.maxPackingListNameLength} characters or fewer.`
  let isActive = true

  const nameSchema = v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter a list name.'),
    v.maxLength(limits.maxPackingListNameLength, nameLengthMessage)
  )

  const isRenaming = computed(() => packingListsStore.isPackingListRenaming(packingListId))
  const isDeleting = computed(() => packingListsStore.isPackingListDeleting(packingListId))

  const isActionDisabled = computed(() => !available || isRenaming.value || isDeleting.value || packingListsStore.isPackingListCopying(packingListId)
    || packingListsStore.isPackingListClearingPacked(packingListId)
    || packingListsStore.isPackingListRefreshingPacked(packingListId)
    || packingListsStore.isPackingListPackedUnconfirmed(packingListId))

  const isConfirmDisabled = computed(() => isActionDisabled.value || editedName.value.trim() === name)

  onBeforeUnmount(() => {
    isActive = false
  })

  async function initializeDialog() {
    editedName.value = name
    nameErrorMessage.value = undefined
    errorMessage.value = null
    announcement.value = ''

    await nextTick()
    nameInput.value?.focus()
  }

  watch(isDialogVisible, (isVisible) => {
    if (isVisible) {
      void initializeDialog()
    }
  })

  async function handleRename() {
    if (isConfirmDisabled.value) {
      return
    }

    const result = v.safeParse(nameSchema, editedName.value)

    nameErrorMessage.value = undefined
    errorMessage.value = null

    if (!result.success) {
      nameErrorMessage.value = result.issues[0].message

      await nextTick()
      nameInput.value?.focus()

      return
    }

    try {
      const saved = await packingListsStore.renamePackingList(packingListId, result.output)

      if (!isActive) {
        return
      }

      emit('renamed', saved.name, saved.updatedAt)

      isDialogVisible.value = false
      announcement.value = 'Packing list renamed.'
    } catch (error) {
      globalThis.console.error('Failed to rename packing list:', error)

      if (!isActive) {
        return
      }

      errorMessage.value = 'Could not save the name. Try again.'

      await nextTick()

      if (isActive) {
        nameInput.value?.focus()
      }
    }
  }
</script>

<style module>
  .component {
    display: contents;
  }

  .announcement {
    position: absolute;
    overflow: hidden;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
