<template>
  <ConfirmationDialog
    v-model="isOpened"
    :header-text="headerText"
    :confirm-button-text="confirmText"
    :close-on-confirm="false"
    :confirm-disabled="loading"
    :confirm-loading="loading"
    :error="error"
    @confirm="handleSubmit"
  >
    <form novalidate @submit.prevent="handleSubmit">
      <TextInput
        ref="nameInput"
        v-model="name"
        name="custom-gear-name"
        label="Gear name"
        :disabled="loading"
        :error="nameError"
        required
      />
    </form>
  </ConfirmationDialog>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
  import * as v from 'valibot'
  import { limits } from '#shared/constants'
  import TextInput from '~/components/TextInput.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'

  interface Props {
    error: string | null;
    initialName: string;
    loading: boolean;
    renaming: boolean;
  }

  type Emits = (event: 'save', name: string) => void

  const { error, initialName, loading, renaming } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isOpened = defineModel<boolean>({ required: true })
  const name = ref('')
  const nameError = ref<string>()
  const nameInput = useTemplateRef('nameInput')
  const headerText = computed(() => renaming ? 'Rename custom gear' : 'Add custom gear')
  const confirmText = computed(() => renaming ? 'Save name' : 'Add gear')
  const lengthMessage = `Use ${limits.maxUserEquipmentCustomNameLength} characters or fewer.`

  const nameSchema = v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter a gear name.'),
    v.maxLength(limits.maxUserEquipmentCustomNameLength, lengthMessage)
  )

  watch(isOpened, async (opened) => {
    if (!opened) {
      return
    }

    name.value = initialName
    nameError.value = undefined

    await nextTick()
    nameInput.value?.focus()
  })

  watch(() => loading, async (isLoading) => {
    if (isLoading || !isOpened.value || error === null) {
      return
    }

    await nextTick()

    if (isOpened.value) {
      nameInput.value?.focus()
    }
  })

  async function handleSubmit() {
    if (loading) {
      return
    }

    const result = v.safeParse(nameSchema, name.value)

    nameError.value = undefined

    if (!result.success) {
      nameError.value = result.issues[0].message

      await nextTick()
      nameInput.value?.focus()

      return
    }

    emit('save', result.output)
  }
</script>
