<template>
  <ModalDialog v-model="opened" :class="$style.component" :aria-labelledby="headingId" :close-disabled="saving">
    <form :class="$style.content" @submit.prevent="save">
      <h2 :id="headingId">{{ heading }}</h2>
      <TextInput ref="nameInput" v-model="name" label="Name" name="name" required :maxlength="limits.maxPropertyEnumOptionNameLength" :disabled="saving" :error="nameError" @update:model-value="changeName" />
      <TextInput ref="slugInput" v-model="slug" label="Slug" name="slug" required :maxlength="limits.maxPropertyEnumOptionSlugLength" :disabled="saving" :error="slugError" hint="Lowercase letters, numbers, and single hyphens." @update:model-value="changeSlug" />
      <p v-if="usageMessage" :class="$style.hint">{{ usageMessage }}</p>
      <p v-if="generalError" ref="formAlert" :class="$style.error" role="alert" tabindex="-1">{{ generalError }}</p>
      <div :class="$style.actions">
        <PerdButton variant="secondary" :disabled="saving" @click="close">Cancel</PerdButton>
        <PerdButton type="submit" :loading="saving">{{ saveLabel }}</PerdButton>
      </div>
    </form>
  </ModalDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
  import { useRequestFetch } from '#imports'
  import { limits } from '#shared/constants'

  import type {
    AdminCategoryPropertiesSnapshot,
    AdminPropertyOption
  } from '#server/utils/equipment/category-properties'

  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import TextInput from '~/components/TextInput.vue'
  import { getCategoryPropertiesErrorCode } from '~/utils/category-properties-error'
  import { getFetchErrorResponse } from '~/utils/fetch-error'
  import { suggestReferenceDataSlug } from '~/utils/reference-data-slug'

  interface Props {
    categoryId: number;
    propertyId: number;
    option: AdminPropertyOption | null;
    revision: number;
  }
  interface Emits {
    saved: [snapshot: AdminCategoryPropertiesSnapshot];
    conflict: [];
  }

  const { categoryId, propertyId, option, revision } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const opened = defineModel<boolean>({ required: true })
  const requestFetch = useRequestFetch()
  const headingId = useId()
  const nameInput = useTemplateRef('nameInput')
  const slugInput = useTemplateRef('slugInput')
  const formAlert = useTemplateRef('formAlert')
  const name = ref('')
  const slug = ref('')
  const manualSlug = ref(false)
  const saving = ref(false)
  const expectedRevision = ref(0)
  const nameError = ref<string>()
  const slugError = ref<string>()
  const generalError = ref('')
  const heading = computed(() => option === null ? 'Add option' : 'Edit option')
  const saveLabel = computed(() => option === null ? 'Create option' : 'Save option')
  const usageMessage = computed(() => option?.usedItemCount ? `${option.usedItemCount} items use this option. Changing its slug also updates their saved choice.` : '')

  function changeName() {
    nameError.value = undefined

    if (!manualSlug.value && option === null) {
      slug.value = suggestReferenceDataSlug(name.value, limits.maxPropertyEnumOptionSlugLength)
      slugError.value = undefined
    }
  }
  function changeSlug() {
    manualSlug.value = true
    slugError.value = undefined
  }
  function close() {
    opened.value = false
  }
  async function save() {
    if (saving.value) {
      return
    }

    const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug.value.trim())

    if (name.value.trim() === '') {
      nameError.value = 'Enter a name.'
    }

    if (!validSlug) {
      slugError.value = 'Use lowercase letters, numbers, and single hyphens.'
    }

    if (nameError.value !== undefined || slugError.value !== undefined) {
      if (nameError.value === undefined) {
        slugInput.value?.focus()
      } else {
        nameInput.value?.focus()
      }

      return
    }

    saving.value = true
    generalError.value = ''

    const path = `/api/equipment/categories/${categoryId}/properties/${propertyId}/enum-options` as const

    const body = {
      expectedPropertiesRevision: expectedRevision.value,
      name: name.value.trim(),
      slug: slug.value.trim()
    }

    try {
      const snapshot = option === null
        ? await requestFetch(path, {
          method: 'POST',
          body
        })
        : await requestFetch(`${path}/${option.id}`, {
          method: 'PATCH',
          body
        })

      emit('saved', snapshot)

      opened.value = false
    } catch (error) {
      const code = getCategoryPropertiesErrorCode(error)

      if (code === 'option_slug_conflict') {
        slugError.value = 'This slug is already used. Choose another slug.'
        saving.value = false

        await nextTick()
        slugInput.value?.focus()

        return
      }

      const { status } = getFetchErrorResponse(error)

      if (status === 409) {
        emit('conflict')
      }

      generalError.value = status === 409 ? 'Options changed or this slug is already used. Your input is still here. Close this form and reload the list before trying again.' : 'Could not save the option. Your input is still here. Try again.'

      await nextTick()
      formAlert.value?.focus()
    } finally {
      saving.value = false
    }
  }

  watch(opened, async (value) => {
    if (!value) {
      return
    }

    name.value = option?.name ?? ''
    slug.value = option?.slug ?? ''
    manualSlug.value = option !== null
    expectedRevision.value = revision
    nameError.value = undefined
    slugError.value = undefined
    generalError.value = ''

    await nextTick()
    nameInput.value?.focus()
  })
</script>

<style module>
  .component { inline-size: min(100dvw - var(--spacing-32), 30rem); max-inline-size: none; }
  .content { display: grid; gap: var(--spacing-16); padding: var(--spacing-24); border: 1px solid var(--color-border-subtle); background: var(--color-surface-primary); border-radius: var(--border-radius-24); }
  .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--spacing-12); }
  .hint { color: var(--color-text-tertiary); }
  .error { color: var(--color-danger-primary); }
</style>
