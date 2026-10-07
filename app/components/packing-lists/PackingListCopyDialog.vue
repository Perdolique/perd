<template>
  <ConfirmationDialog
    v-model="isDialogVisible"
    header-text="Copy packing list"
    confirm-button-text="Create copy"
    :close-on-backdrop="false"
    :close-on-confirm="false"
    :confirm-disabled="isConfirmDisabled"
    :confirm-loading="isCopying"
    :error="errorMessage"
    @confirm="handleCopy"
  >
    <div :class="$style.component">
      <p>The original list will stay unchanged. All items in the copy will start unpacked.</p>
      <form v-if="isDialogVisible" novalidate @submit.prevent="handleCopy">
        <TextInput
          ref="nameInput"
          v-model="editedName"
          name="packing-list-copy-name"
          label="List name"
          :disabled="isCopying"
          :error="nameErrorMessage"
          required
        />
      </form>
      <PerdButton
        v-if="hasConflict"
        variant="secondary"
        size="small"
        :loading="isRefreshing"
        @click="handleRefresh"
      >
        Refresh original list
      </PerdButton>
      <NuxtLink v-if="showOverviewLink" :to="appRoutes.packingLists">Packing lists</NuxtLink>
      <NuxtLink v-if="hasExpiredSession" to="/login">Sign in</NuxtLink>
    </div>
  </ConfirmationDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
  import { NuxtLink } from '#components'
  import * as v from 'valibot'
  import { limits } from '#shared/constants'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import { packingListCopyName } from '~/utils/packing'
  import { appRoutes } from '~/utils/navigation'
  import PerdButton from '~/components/PerdButton.vue'
  import TextInput from '~/components/TextInput.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'

  interface Props {
    available: boolean;
    name: string;
    packingListId: string;
    refreshOriginal: (signal: AbortSignal) => Promise<void>;
  }

  interface Emits {
    copied: [id: string];
  }

  const { available, name, packingListId, refreshOriginal } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isDialogVisible = defineModel<boolean>({ required: true })
  const store = usePackingListsStore()
  const nameInput = useTemplateRef('nameInput')
  const editedName = ref('')
  const nameErrorMessage = ref<string>()
  const errorMessage = ref<string | null>(null)
  const hasConflict = ref(false)
  const hasUnknownOutcome = ref(false)
  const hasExpiredSession = ref(false)
  const hasMissingOriginal = ref(false)
  const isRefreshing = ref(false)
  const isCopying = computed(() => store.isPackingListCopying(packingListId))
  const showOverviewLink = computed(() => hasUnknownOutcome.value || hasMissingOriginal.value)

  const isConfirmDisabled = computed(() => !available
    || store.isPackingListMutationPending(packingListId)
    || store.isPackingListRenaming(packingListId)
    || hasUnknownOutcome.value
    || hasExpiredSession.value
    || hasMissingOriginal.value
    || isRefreshing.value)

  const nameLengthMessage = `Use ${limits.maxPackingListNameLength} characters or fewer.`

  const nameSchema = v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter a list name.'),
    v.maxLength(limits.maxPackingListNameLength, nameLengthMessage)
  )

  let isActive = true
  let refreshController: AbortController | null = null

  onBeforeUnmount(() => {
    isActive = false

    refreshController?.abort()
  })

  watch(isDialogVisible, async (isVisible) => {
    if (!isVisible) {
      refreshController?.abort()

      return
    }

    editedName.value = packingListCopyName(name)

    await nextTick()
    nameInput.value?.focus()
  }, { immediate: true })

  async function handleRefresh() {
    if (isRefreshing.value) {
      return
    }

    const controller = new globalThis.AbortController()

    refreshController = controller
    isRefreshing.value = true

    try {
      await refreshOriginal(controller.signal)

      if (isActive && !controller.signal.aborted) {
        hasConflict.value = false
        errorMessage.value = null

        await nextTick()

        if (isActive && !controller.signal.aborted) {
          nameInput.value?.focus()
        }
      }
    } catch (error) {
      if (!isActive || controller.signal.aborted) {
        return
      }

      globalThis.console.error('Failed to refresh the original packing list:', error)

      errorMessage.value = 'Could not refresh the original list. Try refreshing again.'
    } finally {
      if (refreshController === controller) {
        refreshController = null
        isRefreshing.value = false
      }
    }
  }

  function showCopyError(error: unknown) {
    const status: unknown = typeof error === 'object' && error !== null
      ? Reflect.get(error, 'statusCode') ?? Reflect.get(error, 'status')
      : undefined

    hasConflict.value = status === 409
    hasExpiredSession.value = status === 401
    hasMissingOriginal.value = status === 404

    const isUncertainResponse = typeof status !== 'number'
      || status === 0
      || status === 500
      || status === 502
      || status === 503
      || status === 504
      || status >= 520

    hasUnknownOutcome.value = isUncertainResponse

    if (hasUnknownOutcome.value) {
      errorMessage.value = 'Could not confirm the copy. Check Packing lists before trying again.'
    } else if (hasConflict.value) {
      errorMessage.value = 'The original list changed or saved gear is unavailable. Refresh the original list before trying again.'
    } else if (hasExpiredSession.value) {
      errorMessage.value = 'Your session expired. Sign in before copying this list.'
    } else if (hasMissingOriginal.value) {
      errorMessage.value = 'The original list is no longer available. Check Packing lists.'
    } else {
      errorMessage.value = 'Could not copy the list. Try again.'
    }
  }

  async function handleCopy() {
    if (!isDialogVisible.value || isConfirmDisabled.value) {
      return
    }

    const result = v.safeParse(nameSchema, editedName.value)

    nameErrorMessage.value = undefined
    errorMessage.value = null
    hasConflict.value = false

    if (!result.success) {
      nameErrorMessage.value = result.issues[0].message

      await nextTick()
      nameInput.value?.focus()

      return
    }

    try {
      const saved = await store.copyPackingList(packingListId, result.output)

      if (!isActive || saved === null) {
        return
      }

      isDialogVisible.value = false

      emit('copied', saved.id)
    } catch (error) {
      globalThis.console.error('Failed to copy packing list:', error)

      if (!isActive) {
        return
      }

      showCopyError(error)
      await nextTick()

      if (isActive) {
        nameInput.value?.focus()
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
