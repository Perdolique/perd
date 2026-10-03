<template>
  <ModalDialog v-model="opened" :class="$style.component" :aria-labelledby="headingId" :close-disabled="saving">
    <form :class="$style.content" @submit.prevent="save">
      <h2 :id="headingId">{{ heading }}</h2>
      <TextInput ref="nameInput" v-model="name" label="Name" name="name" required :maxlength="limits.maxCategoryPropertyNameLength" :disabled="saving" :error="errors.name" @update:model-value="changeName" />
      <TextInput ref="slugInput" v-model="slug" label="Slug" name="slug" required :maxlength="limits.maxCategoryPropertySlugLength" :disabled="saving" :error="errors.slug" hint="Lowercase letters, numbers, and single hyphens. Changing it breaks old URL filters." @update:model-value="changeSlug" />
      <PerdSelect v-model="dataType" label="Type" :options="typeOptions" :disabled="representationDisabled" />
      <p v-if="usedExplanation" :class="$style.hint">{{ usedExplanation }}</p>
      <template v-if="isNumber">
        <TextInput v-model="unit" label="Unit (optional)" name="unit" :maxlength="limits.maxCategoryPropertyUnitLength" :disabled="representationDisabled" :error="errors.unit" @update:model-value="clearUnitError" />
        <label :class="$style.checkbox"><input v-model="allowsNegativeValues" type="checkbox" :disabled="negativeDisabled"> Allow negative values</label>
        <p v-if="negativeExplanation" :class="$style.hint">{{ negativeExplanation }}</p>
      </template>
      <p v-if="leavesEnum" :class="$style.hint">Changing the type deletes all existing options.</p>
      <fieldset v-if="needsOptions" :class="$style.options" :disabled="saving">
        <legend>Initial options</legend>
        <div v-for="(option, index) in initialOptions" :key="option.key" :class="$style.option">
          <TextInput v-model="option.name" :label="option.nameLabel" :name="option.nameField" required :maxlength="limits.maxPropertyEnumOptionNameLength" @update:model-value="suggestOptionSlug(option)" />
          <TextInput v-model="option.slug" :label="option.slugLabel" :name="option.slugField" required :maxlength="limits.maxPropertyEnumOptionSlugLength" @update:model-value="markOptionSlug(option)" />
          <PerdButton variant="secondary" size="small" :disabled="option.removeDisabled" @click="removeOption(index)">Remove option</PerdButton>
        </div>
        <p v-if="errors.enumOptions" :class="$style.error" role="alert">{{ errors.enumOptions }}</p>
        <PerdButton variant="secondary" size="small" @click="addOption">Add option</PerdButton>
      </fieldset>
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
    AdminCategoryProperty,
    AdminCategoryPropertiesSnapshot
  } from '#server/utils/equipment/category-properties'

  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import TextInput from '~/components/TextInput.vue'
  import PerdSelect from '~/components/perd-select/PerdSelect.vue'
  import { getCategoryPropertiesErrorCode } from '~/utils/category-properties-error'
  import { getFetchErrorResponse } from '~/utils/fetch-error'
  import { suggestReferenceDataSlug } from '~/utils/reference-data-slug'

  interface Props {
    categoryId: number;
    property: AdminCategoryProperty | null;
    revision: number;
  }
  interface Emits {
    saved: [snapshot: AdminCategoryPropertiesSnapshot];
    conflict: [];
  }
  interface InitialOption {
    key: number;
    name: string;
    slug: string;
    manualSlug: boolean;
    nameLabel: string;
    nameField: string;
    slugLabel: string;
    slugField: string;
    removeDisabled: boolean;
  }

  const { categoryId, property, revision } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const opened = defineModel<boolean>({ required: true })
  const requestFetch = useRequestFetch()
  const headingId = useId()
  const nameInput = useTemplateRef('nameInput')
  const slugInput = useTemplateRef('slugInput')
  const formAlert = useTemplateRef('formAlert')
  const name = ref('')
  const slug = ref('')
  const dataType = ref('number')
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

  const heading = computed(() => property === null ? 'Add characteristic' : 'Edit characteristic')
  const saveLabel = computed(() => property === null ? 'Create characteristic' : 'Save characteristic')
  const isNumber = computed(() => dataType.value === 'number')
  const representationDisabled = computed(() => saving.value || (property?.usedItemCount ?? 0) > 0)
  const negativeDisabled = computed(() => saving.value || (property?.negativeValueCount ?? 0) > 0)
  const usedExplanation = computed(() => property?.usedItemCount ? `${property.usedItemCount} items have values. Type and unit cannot change.` : '')
  const negativeExplanation = computed(() => property?.negativeValueCount ? `${property.negativeValueCount} items have negative values. Allow negative values cannot be turned off.` : '')
  const needsOptions = computed(() => dataType.value === 'enum' && property?.dataType !== 'enum')
  const leavesEnum = computed(() => property?.dataType === 'enum' && dataType.value !== 'enum')

  function syncOptions() {
    for (const [index, option] of initialOptions.value.entries()) {
      option.nameLabel = `Option ${index + 1} name`
      option.slugLabel = `Option ${index + 1} slug`
      option.removeDisabled = initialOptions.value.length === 1
    }

    errors.value.enumOptions = undefined
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
  function removeOption(index: number) {
    initialOptions.value.splice(index, 1)
    syncOptions()
  }
  function suggestOptionSlug(option: InitialOption) {
    if (!option.manualSlug) {
      option.slug = suggestReferenceDataSlug(option.name, limits.maxPropertyEnumOptionSlugLength)
    }

    errors.value.enumOptions = undefined
  }
  function markOptionSlug(option: InitialOption) {
    option.manualSlug = true
    errors.value.enumOptions = undefined
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
    opened.value = false
  }
  function validateForm() {
    const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

    errors.value.name = name.value.trim() === '' ? 'Enter a name.' : errors.value.name
    errors.value.slug = validSlug.test(slug.value.trim()) ? errors.value.slug : 'Use lowercase letters, numbers, and single hyphens.'

    const options = initialOptions.value.map((option) => {
      return {
        name: option.name.trim(),
        slug: option.slug.trim()
      }
    })

    const slugs = new Set(options.map((option) => option.slug))

    if (needsOptions.value && (options.length === 0 || slugs.size !== options.length || options.some((option) => option.name === '' || !validSlug.test(option.slug)))) {
      errors.value.enumOptions = 'Add at least one named option. Use valid, unique slugs.'
    }

    if (Object.values(errors.value).some((error) => error !== undefined)) {
      if (errors.value.name !== undefined) {
        nameInput.value?.focus()
      } else if (errors.value.slug !== undefined) {
        slugInput.value?.focus()
      }

      return false
    }

    return true
  }
  async function save() {
    if (saving.value || !validateForm()) {
      return
    }

    saving.value = true
    generalError.value = ''

    const body = {
      expectedPropertiesRevision: expectedRevision.value,
      name: name.value.trim(),
      slug: slug.value.trim(),
      dataType: dataType.value,
      unit: isNumber.value ? unit.value.trim() || null : null,
      allowsNegativeValues: isNumber.value && allowsNegativeValues.value,

      enumOptions: needsOptions.value ? initialOptions.value.map((option) => {
        return {
          name: option.name.trim(),
          slug: option.slug.trim()
        }
      }) : undefined
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
        emit('conflict')
      }

      generalError.value = status === 409 ? 'Characteristics changed or this edit is no longer allowed. Your input is still here. Close this form and reload the list before trying again.' : 'Could not save the characteristic. Your input is still here. Try again.'

      await nextTick()
      formAlert.value?.focus()
    } finally {
      saving.value = false
    }
  }

  watch(dataType, () => {
    errors.value.enumOptions = undefined
    errors.value.unit = undefined
  })

  watch(opened, async (value) => {
    if (!value) {
      return
    }

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
  .component { inline-size: min(100dvw - var(--spacing-32), 36rem); max-inline-size: none; }
  .content { display: grid; gap: var(--spacing-16); padding: var(--spacing-24); background: var(--color-surface-primary); border: 1px solid var(--color-border-subtle); border-radius: var(--border-radius-24); }
  .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--spacing-12); }
  .options, .option { display: grid; gap: var(--spacing-12); }
  .checkbox { display: flex; gap: var(--spacing-8); align-items: center; }
  .hint { color: var(--color-text-tertiary); }
  .error { color: var(--color-danger-primary); }
</style>
