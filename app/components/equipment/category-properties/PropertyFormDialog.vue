<template>
  <ModalDialog v-model="opened" :class="$style.component" :aria-labelledby="headingId" :close-disabled="closeDisabled">
    <div :class="$style.content">
      <header :class="$style.header"><h2 :id="headingId" :class="$style.heading">{{ heading }}</h2><PerdIconButton icon="hugeicons:cancel-01" label="Close characteristic editor" :disabled="closeDisabled" :class="$style.close" @click="close" /></header>
      <div :class="$style.body">
        <form :id="formId" ref="form" :class="$style.form" @submit.prevent="save">
          <TextInput ref="nameInput" v-model="name" label="Name" name="name" required :maxlength="limits.maxCategoryPropertyNameLength" :disabled="fieldsDisabled" :error="errors.name" @update:model-value="changeName" />
          <TextInput ref="slugInput" v-model="slug" label="Slug" name="slug" required :maxlength="limits.maxCategoryPropertySlugLength" :disabled="fieldsDisabled" :error="errors.slug" hint="Changing the slug breaks existing URL filters." @update:model-value="changeSlug" />
          <PerdSelect v-model="dataType" label="Type" :options="typeOptions" :disabled="representationDisabled" />
          <p v-if="usedExplanation" :class="$style.hint"><Icon name="hugeicons:lock-key" aria-hidden="true" /> {{ usedExplanation }}</p>
          <template v-if="isNumber">
            <TextInput v-model="unit" label="Unit (optional)" name="unit" :maxlength="limits.maxCategoryPropertyUnitLength" :disabled="representationDisabled" :error="errors.unit" @update:model-value="clearUnitError" />
            <label :class="$style.checkbox"><input v-model="allowsNegativeValues" type="checkbox" :disabled="negativeDisabled"> Allow negative values</label>
            <p v-if="negativeExplanation" :class="$style.hint">{{ negativeExplanation }}</p>
          </template>
          <p v-if="leavesEnum" :class="$style.hint">Changing the type deletes all existing options.</p>
          <fieldset v-if="needsOptions" :class="$style.options" :disabled="fieldsDisabled">
            <legend>Initial options</legend>
            <div v-for="(option, index) in initialOptions" :key="option.key" :class="$style.option">
              <TextInput v-model="option.name" :label="option.nameLabel" :name="option.nameField" required :maxlength="limits.maxPropertyEnumOptionNameLength" :error="option.nameError" @update:model-value="suggestOptionSlug(option)" />
              <TextInput v-model="option.slug" :label="option.slugLabel" :name="option.slugField" required :maxlength="limits.maxPropertyEnumOptionSlugLength" :error="option.slugError" @update:model-value="markOptionSlug(option)" />
              <PerdButton variant="secondary" size="small" :disabled="option.removeDisabled" @click="removeOption(index)">Remove option</PerdButton>
            </div>
            <PerdButton ref="addOptionButton" variant="secondary" size="small" @click="addOption">Add option</PerdButton>
          </fieldset>
          <p v-if="generalError" ref="formAlert" :class="$style.error" role="alert" tabindex="-1">{{ generalError }}</p>
        </form>
        <PropertyOptionsEditor v-if="existingEnumProperty" v-model:active="optionActive" :category-id="categoryId" :property="existingEnumProperty" :revision="expectedRevision" :disabled="optionsDisabled" @saved="acceptOptionSnapshot" @conflict="handleConflict" />
      </div>
      <footer :class="$style.actions">
        <PerdButton size="small" variant="secondary" :disabled="closeDisabled" @click="close">Cancel</PerdButton>
        <PerdButton size="small" type="submit" :form="formId" :disabled="fieldsDisabled" :loading="saving">{{ saveLabel }}</PerdButton>
      </footer>
    </div>
  </ModalDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
  import { useRequestFetch } from '#imports'
  import { limits } from '#shared/constants'

  import type {
    AdminCategoryProperty,
    AdminCategoryPropertiesSnapshot
  } from '#server/utils/equipment/category-properties'

  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdIconButton from '~/components/PerdIconButton.vue'
  import PropertyOptionsEditor from './PropertyOptionsEditor.vue'
  import TextInput from '~/components/TextInput.vue'
  import PerdSelect from '~/components/perd-select/PerdSelect.vue'

  import {
    getCategoryPropertiesErrorCode,
    logUnexpectedCategoryPropertiesError
  } from '~/utils/category-properties-error'

  import { getFetchErrorResponse } from '~/utils/fetch-error'
  import { suggestReferenceDataSlug } from '~/utils/reference-data-slug'

  interface InitialOption {
    key: number;
    name: string;
    slug: string;
    manualSlug: boolean;
    nameLabel: string;
    nameField: string;
    nameError?: string;
    slugLabel: string;
    slugField: string;
    slugError?: string;
    removeDisabled: boolean;
  }
  interface Props {
    categoryId: number;
    property: AdminCategoryProperty | null;
    revision: number;
  }
  interface Emits {
    saved: [snapshot: AdminCategoryPropertiesSnapshot];
    conflict: [];
  }

  const { categoryId, property, revision } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const opened = defineModel<boolean>({ required: true })
  const requestFetch = useRequestFetch()
  const headingId = useId()
  const formId = useId()
  const optionActive = ref(false)
  const conflicted = ref(false)
  const form = useTemplateRef('form')
  const nameInput = useTemplateRef('nameInput')
  const slugInput = useTemplateRef('slugInput')
  const addOptionButton = useTemplateRef('addOptionButton')
  const formAlert = useTemplateRef('formAlert')
  const name = ref('')
  const slug = ref('')
  const dataType = ref<AdminCategoryProperty['dataType']>('number')
  const unit = ref('')
  const allowsNegativeValues = ref(false)
  const manualSlug = ref(false)
  const saving = ref(false)
  const expectedRevision = ref(0)
  const errors = ref<Record<string, string | undefined>>({})
  const generalError = ref('')
  const initialOptions = ref<InitialOption[]>([])
  let optionKey = 0

  const typeOptions = [
    {
      label: 'Number',
      value: 'number'
    }, {
      label: 'Text',
      value: 'text'
    },
    {
      label: 'Boolean',
      value: 'boolean'
    }, {
      label: 'Enum',
      value: 'enum'
    }
  ]

  const closeDisabled = computed(() => saving.value || optionActive.value)
  const fieldsDisabled = computed(() => closeDisabled.value || conflicted.value)
  const optionsDisabled = computed(() => saving.value || conflicted.value)

  const existingEnumProperty = computed(() => {
    const showOptions = opened.value && property?.dataType === 'enum' && dataType.value === 'enum'

    return showOptions ? property : null
  })

  const heading = computed(() => property === null ? 'Add characteristic' : 'Edit characteristic')
  const saveLabel = computed(() => property === null ? 'Create characteristic' : 'Save characteristic')
  const isNumber = computed(() => dataType.value === 'number')
  const representationDisabled = computed(() => fieldsDisabled.value || (property?.usedItemCount ?? 0) > 0)
  const negativeDisabled = computed(() => fieldsDisabled.value || (property?.negativeValueCount ?? 0) > 0)
  const usedExplanation = computed(() => property?.usedItemCount ? `${property.usedItemCount} items have values. Type and unit cannot change.` : '')
  const negativeExplanation = computed(() => property?.negativeValueCount ? `${property.negativeValueCount} items have negative values. Allow negative values cannot be turned off.` : '')
  const needsOptions = computed(() => dataType.value === 'enum' && property?.dataType !== 'enum')
  const leavesEnum = computed(() => property?.dataType === 'enum' && dataType.value !== 'enum')

  function syncOptions() {
    const optionsWithIndexes = initialOptions.value.entries()

    for (const [index, option] of optionsWithIndexes) {
      option.nameLabel = `Option ${index + 1} name`
      option.slugLabel = `Option ${index + 1} slug`
      option.removeDisabled = initialOptions.value.length === 1
    }
  }
  function addOption() {
    optionKey += 1

    const position = initialOptions.value.length + 1

    initialOptions.value.push({
      key: optionKey,
      name: '',
      slug: '',
      manualSlug: false,
      nameLabel: `Option ${position} name`,
      nameField: `option-${optionKey}-name`,
      slugLabel: `Option ${position} slug`,
      slugField: `option-${optionKey}-slug`,
      removeDisabled: true
    })

    syncOptions()
  }
  async function removeOption(index: number) {
    initialOptions.value.splice(index, 1)
    syncOptions()
    await nextTick()

    const nextOption = initialOptions.value[index] ?? initialOptions.value.at(-1)

    if (nextOption === undefined) {
      addOptionButton.value?.focus()

      return
    }

    const fieldSelector = `input[name="${nextOption.nameField}"]`
    const nextInput = form.value?.querySelector<HTMLInputElement>(fieldSelector)

    nextInput?.focus()
  }
  function suggestOptionSlug(option: InitialOption) {
    option.nameError = undefined

    if (!option.manualSlug) {
      option.slug = suggestReferenceDataSlug(option.name, limits.maxPropertyEnumOptionSlugLength)
      option.slugError = undefined
    }
  }
  function markOptionSlug(option: InitialOption) {
    option.manualSlug = true
    option.slugError = undefined
  }
  function changeName() {
    errors.value.name = undefined

    if (!manualSlug.value && property === null) {
      slug.value = suggestReferenceDataSlug(name.value, limits.maxCategoryPropertySlugLength)
      errors.value.slug = undefined
    }
  }
  function changeSlug() {
    manualSlug.value = true
    errors.value.slug = undefined
  }
  function clearUnitError() {
    errors.value.unit = undefined
  }
  function close() {
    if (!closeDisabled.value) { opened.value = false }
  }
  function acceptOptionSnapshot(snapshot: AdminCategoryPropertiesSnapshot) {
    expectedRevision.value = snapshot.category.propertiesRevision

    emit('saved', snapshot)
  }
  function handleConflict() {
    conflicted.value = true

    emit('conflict')
  }
  function validateForm() {
    const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
    const trimmedName = name.value.trim()
    const trimmedSlug = slug.value.trim()
    const isSlugValid = validSlug.test(trimmedSlug)

    errors.value.name = trimmedName === '' ? 'Enter a name.' : errors.value.name
    errors.value.slug = isSlugValid ? errors.value.slug : 'Use lowercase letters, numbers, and single hyphens.'

    let hasOptionErrors = false

    if (needsOptions.value) {
      const slugs = new Set<string>()

      for (const option of initialOptions.value) {
        const optionName = option.name.trim()
        const optionSlug = option.slug.trim()
        const isOptionSlugValid = validSlug.test(optionSlug)
        const isDuplicateSlug = slugs.has(optionSlug)

        option.nameError = optionName === '' ? 'Enter an option name.' : undefined
        option.slugError = undefined

        if (!isOptionSlugValid) {
          option.slugError = 'Use lowercase letters, numbers, and single hyphens.'
        } else if (isDuplicateSlug) {
          option.slugError = 'Use a unique option slug.'
        }

        slugs.add(optionSlug)

        if (option.nameError !== undefined || option.slugError !== undefined) {
          hasOptionErrors = true
        }
      }
    }

    const fieldErrors = Object.values(errors.value)
    const hasFieldErrors = fieldErrors.some((error) => error !== undefined)
    const isValid = !hasFieldErrors && !hasOptionErrors

    return isValid
  }
  async function save() {
    if (fieldsDisabled.value) {
      return
    }

    const isValid = validateForm()

    if (!isValid) {
      await nextTick()

      const firstInvalidInput = form.value?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')

      firstInvalidInput?.focus()

      return
    }

    saving.value = true
    generalError.value = ''

    const submittedName = name.value.trim()
    const submittedSlug = slug.value.trim()
    const trimmedUnit = unit.value.trim()
    const submittedUnit = isNumber.value ? trimmedUnit || null : null
    const submittedAllowsNegativeValues = isNumber.value && allowsNegativeValues.value

    const submittedOptions = needsOptions.value ? initialOptions.value.map((option) => {
      const optionName = option.name.trim()
      const optionSlug = option.slug.trim()

      return {
        name: optionName,
        slug: optionSlug
      }
    }) : undefined

    const body = {
      expectedPropertiesRevision: expectedRevision.value,
      name: submittedName,
      slug: submittedSlug,
      dataType: dataType.value,
      unit: submittedUnit,
      allowsNegativeValues: submittedAllowsNegativeValues,
      enumOptions: submittedOptions
    }

    const path = `/api/equipment/categories/${categoryId}/properties` as const

    try {
      const snapshot = property === null
        ? await requestFetch(path, {
          method: 'POST',
          body
        })
        : await requestFetch(`${path}/${property.id}`, {
          method: 'PATCH',
          body
        })

      emit('saved', snapshot)

      opened.value = false
    } catch (error) {
      logUnexpectedCategoryPropertiesError('Failed to save characteristic:', error)

      const code = getCategoryPropertiesErrorCode(error)

      if (code === 'property_slug_conflict') {
        errors.value.slug = 'This slug is already used. Choose another slug.'
        saving.value = false

        await nextTick()
        slugInput.value?.focus()

        return
      }

      const { status } = getFetchErrorResponse(error)

      if (status === 409) {
        handleConflict()
      }

      generalError.value = status === 409 ? 'Characteristics changed or this edit is no longer allowed. Your input is still here. Close this form and reload the list before trying again.' : 'Could not save the characteristic. Your input is still here. Try again.'

      await nextTick()
      formAlert.value?.focus()
    } finally {
      saving.value = false
    }
  }

  watch(dataType, () => {
    errors.value.unit = undefined

    for (const option of initialOptions.value) {
      option.nameError = undefined
      option.slugError = undefined
    }
  })

  watch(opened, async (value) => {
    if (!value) {
      return
    }

    optionActive.value = false
    conflicted.value = false
    name.value = property?.name ?? ''
    slug.value = property?.slug ?? ''
    dataType.value = property?.dataType ?? 'number'
    unit.value = property?.unit ?? ''
    allowsNegativeValues.value = property?.allowsNegativeValues ?? false
    manualSlug.value = property !== null
    expectedRevision.value = revision
    errors.value = {}
    generalError.value = ''
    initialOptions.value = []

    addOption()
    await nextTick()
    nameInput.value?.focus()
  })
</script>

<style module>
  .component { inline-size: min(100dvw - var(--spacing-32), 32rem); max-inline-size: none; max-block-size: calc(100dvb - var(--spacing-32)); overflow: hidden; border-radius: var(--border-radius-10); }
  .component[open]::backdrop { backdrop-filter: none; }
  .content { --field-control-height: var(--layout-button-height-small); --field-hint-color: var(--color-text-secondary); display: flex; flex-direction: column; max-block-size: calc(100dvb - var(--spacing-32)); background: var(--color-surface-primary); border: 1px solid var(--color-border-subtle); border-radius: inherit; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-12); padding: var(--spacing-16) var(--spacing-20); flex: none; }
  .heading { font-size: var(--font-size-20); }
  .close { inline-size: var(--layout-touch-target); block-size: var(--layout-touch-target); flex: none; --icon-button-color: var(--color-text-secondary); }
  .body { display: grid; gap: var(--spacing-32); min-block-size: 0; overflow: auto; overscroll-behavior: contain; padding: var(--spacing-4) var(--spacing-20) var(--spacing-24); }
  .form { display: grid; gap: var(--spacing-16); }
  .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--spacing-12); padding: var(--spacing-16) var(--spacing-20); border-block-start: 1px solid var(--color-border-subtle); flex: none; }
  .options, .option { display: grid; gap: var(--spacing-12); }
  .checkbox { display: flex; gap: var(--spacing-8); align-items: center; }
  .hint { display: flex; align-items: baseline; gap: var(--spacing-8); color: var(--color-text-secondary); font-size: var(--font-size-14); }
  .error { color: var(--color-danger-primary); }
  @media (width < 600px) {
    .component { --dialog-open-inline-translate: 0; --dialog-closed-inline-translate: 0; left: 0; right: 0; inline-size: auto; max-block-size: 100dvb; border-radius: 0; }
    .content { max-block-size: 100dvb; padding-block-end: var(--layout-safe-bottom); }
    .header, .body, .actions { padding-inline: var(--spacing-16); }
  }
</style>
