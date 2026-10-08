<template>
  <section ref="section" :class="$style.component" :aria-labelledby="headingId">
    <h3 :id="headingId" :class="$style.heading">Options ({{ property.enumOptions.length }})</h3>
    <div :class="$style.catalog">
      <table :class="$style.table">
        <thead :class="$style.tableHead">
          <tr><th scope="col" :class="$style.columnHeading">Name</th><th scope="col" :class="$style.columnHeading">Slug</th><th scope="col" :class="$style.usageHeading">Items</th><th scope="col" :class="$style.actionsHeading">Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.option.id" :class="$style.row" :data-option-id="row.option.id">
            <td :class="$style.name">{{ row.option.name }}</td>
            <td :class="$style.slug">{{ row.option.slug }}</td>
            <td :class="$style.usage">{{ row.option.usedItemCount }}<span :class="$style.usageUnit"> items</span></td>
            <td :class="$style.controls">
              <div :class="$style.actions">
                <PerdIconButton icon="hugeicons:pencil-edit-02" :label="row.editLabel" :disabled="controlsDisabled" :class="$style.iconButton" @click="openOption(row.option)" />
                <PerdActionMenu :label="row.actionsLabel" :menu-label="row.menuLabel" :items="row.items" :disabled="controlsDisabled" @action="prepareDelete(row.option)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <form v-if="formOpen" :class="$style.form" @submit.prevent="save">
      <h4>{{ formHeading }}</h4>
      <div :class="$style.fields"><TextInput ref="nameInput" v-model="name" label="Option name" name="option-name" required :maxlength="limits.maxPropertyEnumOptionNameLength" :disabled="saving" :error="nameError" @update:model-value="changeName" /><TextInput ref="slugInput" v-model="slug" label="Option slug" name="option-slug" required :maxlength="limits.maxPropertyEnumOptionSlugLength" :disabled="saving" :error="slugError" @update:model-value="changeSlug" /></div>
      <p v-if="usageMessage" :class="$style.hint">{{ usageMessage }}</p>
      <p v-if="errorMessage" role="alert" :class="$style.error">{{ errorMessage }}</p>
      <div :class="$style.formActions"><PerdButton size="small" variant="secondary" :disabled="saving" @click="cancel">Cancel option</PerdButton><PerdButton size="small" type="submit" :disabled="disabled" :loading="saving">{{ saveLabel }}</PerdButton></div>
    </form>
    <div v-if="deleting" :class="$style.form">
      <p>Delete {{ deleting.name }}? This option is not used by any items.</p>
      <p v-if="errorMessage" role="alert" :class="$style.error">{{ errorMessage }}</p>
      <div :class="$style.formActions"><PerdButton ref="cancelDeleteButton" size="small" variant="secondary" :disabled="saving" @click="cancel">Cancel deletion</PerdButton><PerdButton size="small" variant="danger" :loading="saving" :disabled="disabled" @click="deleteOption">Delete option</PerdButton></div>
    </div>
    <PerdButton ref="addButton" size="small" variant="secondary" icon="hugeicons:add-01" :disabled="controlsDisabled" :class="$style.add" @click="openOption(null)">Add option</PerdButton>
    <p :class="$style.hint"><Icon name="hugeicons:lock-key" aria-hidden="true" /> {{ deletionHint }}</p>
    <p :class="$style.announcement" role="status">{{ announcement }}</p>
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'
  import { useRequestFetch } from '#imports'
  import { limits } from '#shared/constants'

  import type {
    AdminCategoryProperty,
    AdminCategoryPropertiesSnapshot,
    AdminPropertyOption
  } from '#server/utils/equipment/category-properties'

  import PerdButton from '~/components/PerdButton.vue'
  import PerdIconButton from '~/components/PerdIconButton.vue'
  import PerdActionMenu, { type ActionMenuItem } from '~/components/PerdActionMenu.vue'
  import TextInput from '~/components/TextInput.vue'
  import { suggestReferenceDataSlug } from '~/utils/reference-data-slug'

  import {
    getCategoryPropertiesErrorCode,
    logUnexpectedCategoryPropertiesError
  } from '~/utils/category-properties-error'

  import { getFetchErrorResponse } from '~/utils/fetch-error'

  interface Props {
    categoryId: number;
    property: AdminCategoryProperty;
    revision: number;
    disabled: boolean;
  }
  interface Emits {
    saved: [snapshot: AdminCategoryPropertiesSnapshot];
    conflict: [];
  }

  const { categoryId, property, revision, disabled } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const active = defineModel<boolean>('active', { required: true })
  const headingId = useId()
  const section = useTemplateRef('section')
  const addButton = useTemplateRef('addButton')
  const nameInput = useTemplateRef('nameInput')
  const slugInput = useTemplateRef('slugInput')
  const cancelDeleteButton = useTemplateRef('cancelDeleteButton')
  const requestFetch = useRequestFetch()
  const editingOption = ref<AdminPropertyOption | null>(null)
  const deleting = ref<AdminPropertyOption | null>(null)
  const formOpen = ref(false)
  const saving = ref(false)
  const name = ref('')
  const slug = ref('')
  const manualSlug = ref(false)
  const nameError = ref<string>()
  const slugError = ref<string>()
  const errorMessage = ref('')
  const announcement = ref('')
  const expectedRevision = ref(revision)
  const controlsDisabled = computed(() => disabled || active.value)
  const formHeading = computed(() => editingOption.value === null ? 'Add option' : 'Edit option')
  const saveLabel = computed(() => editingOption.value === null ? 'Create option' : 'Save option')
  const usageMessage = computed(() => editingOption.value?.usedItemCount ? `${editingOption.value.usedItemCount} items use this option. Changing its slug also updates their saved choice.` : '')
  const deletionHint = computed(() => property.enumOptions.length === 1 ? 'Keep at least one option.' : 'Options used by items cannot be deleted.')

  const rows = computed(() => property.enumOptions.map((option) => {
    let deleteReason = ''

    if (option.usedItemCount > 0) { deleteReason = 'Used by items. Cannot delete.' } else if (property.enumOptions.length === 1) { deleteReason = 'Keep at least one option.' }

    return {
      option,
      editLabel: `Edit option ${option.name}`,
      actionsLabel: `Actions for option ${option.name}`,
      menuLabel: `${option.name} option actions`,

      items: [{
        id: 'delete',
        label: 'Delete option',
        icon: 'hugeicons:delete-02',
        danger: true,
        hint: deleteReason,
        disabled: deleteReason !== ''
      }] satisfies ActionMenuItem[]
    }
  }))

  async function openOption(option: AdminPropertyOption | null) {
    editingOption.value = option
    name.value = option?.name ?? ''
    slug.value = option?.slug ?? ''
    manualSlug.value = option !== null
    expectedRevision.value = revision
    nameError.value = undefined
    slugError.value = undefined
    errorMessage.value = ''
    active.value = true
    formOpen.value = true

    await nextTick()
    nameInput.value?.focus()
  }

  async function prepareDelete(option: AdminPropertyOption) {
    deleting.value = option
    expectedRevision.value = revision
    errorMessage.value = ''
    active.value = true

    await nextTick()
    cancelDeleteButton.value?.focus()
  }

  async function cancel() {
    const id = editingOption.value?.id ?? deleting.value?.id

    formOpen.value = false
    editingOption.value = null
    deleting.value = null
    active.value = false

    await nextTick()

    const button = section.value?.querySelector<HTMLElement>(`[data-option-id="${id}"] button`)

    if (button) { button.focus() } else { addButton.value?.focus() }
  }

  function changeName() {
    nameError.value = undefined

    if (!manualSlug.value && editingOption.value === null) {
      slug.value = suggestReferenceDataSlug(name.value, limits.maxPropertyEnumOptionSlugLength)
      slugError.value = undefined
    }
  }

  function changeSlug() { manualSlug.value = true; slugError.value = undefined }

  async function save() {
    if (saving.value || disabled) { return }

    const trimmedName = name.value.trim()

    nameError.value = trimmedName === '' ? 'Enter a name.' : undefined

    const trimmedSlug = slug.value.trim()
    const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(trimmedSlug)

    slugError.value = validSlug ? undefined : 'Use lowercase letters, numbers, and single hyphens.'

    if (nameError.value || slugError.value) {
      await nextTick()

      if (nameError.value) { nameInput.value?.focus() } else { slugInput.value?.focus() }

      return
    }

    saving.value = true
    errorMessage.value = ''

    const path = `/api/equipment/categories/${categoryId}/properties/${property.id}/enum-options` as const

    const body = {
      expectedPropertiesRevision: expectedRevision.value,
      name: trimmedName,
      slug: trimmedSlug
    }

    try {
      const snapshot = editingOption.value === null
        ? await requestFetch(path, {
          method: 'POST',
          body
        })
        : await requestFetch(`${path}/${editingOption.value.id}`, {
          method: 'PATCH',
          body
        })

      emit('saved', snapshot)

      announcement.value = 'Option saved.'

      await cancel()
    } catch (error) {
      logUnexpectedCategoryPropertiesError('Failed to save characteristic option:', error)

      const code = getCategoryPropertiesErrorCode(error)

      if (code === 'option_slug_conflict') {
        slugError.value = 'This slug is already used. Choose another slug.'
      } else {
        const { status } = getFetchErrorResponse(error)

        if (status === 409) { emit('conflict') }

        errorMessage.value = status === 409 ? 'Options changed. Your input is still here. Cancel and reload characteristics.' : 'Could not save the option. Your input is still here. Try again.'
      }
    } finally { saving.value = false }
  }

  async function deleteOption() {
    if (saving.value || disabled || deleting.value === null) { return }

    saving.value = true
    errorMessage.value = ''

    try {
      const expectedPropertiesRevision = String(expectedRevision.value)

      const result = await requestFetch(`/api/equipment/categories/${categoryId}/properties/${property.id}/enum-options/${deleting.value.id}`, {
        method: 'DELETE',
        query: { expectedPropertiesRevision }
      })

      emit('saved', result)

      announcement.value = 'Option deleted.'

      await cancel()
    } catch (error) {
      logUnexpectedCategoryPropertiesError('Failed to delete characteristic option:', error)

      const { status } = getFetchErrorResponse(error)

      if (status === 409) { emit('conflict') }

      errorMessage.value = status === 409 ? 'This option may now be in use or the list changed. Cancel and reload characteristics.' : 'Could not delete this option. Try again.'
    } finally { saving.value = false }
  }
</script>

<style module>
  .component {
    --option-control-size: var(--spacing-40);

    container-type: inline-size;
    display: grid;
    gap: var(--spacing-12);
  }

  .heading { font-size: var(--font-size-16); font-weight: var(--font-weight-medium); }
  .catalog { overflow: clip; border: 1px solid var(--color-border-subtle); border-radius: var(--border-radius-6); }
  .table { inline-size: 100%; table-layout: fixed; border-collapse: collapse; font-size: var(--font-size-14); }
  .tableHead { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
  .columnHeading, .usageHeading, .actionsHeading { padding: var(--spacing-8); font-weight: var(--font-weight-medium); text-align: start; }
  .usageHeading { inline-size: 3.5rem; }
  .actionsHeading { inline-size: calc(var(--option-control-size) * 2 + var(--spacing-24)); }
  .row { border-block-start: 1px solid var(--color-border-subtle); overflow-wrap: anywhere; }
  .name, .slug, .usage, .controls { padding: var(--spacing-8); vertical-align: middle; }
  .name { font-weight: var(--font-weight-medium); }
  .slug, .usage, .hint { color: var(--color-text-secondary); }
  .usage { font-variant-numeric: tabular-nums; }
  .usageUnit { display: none; }
  .hint { display: flex; gap: var(--spacing-8); align-items: baseline; font-size: var(--font-size-14); }
  .actions { display: flex; gap: var(--spacing-8); }
  .iconButton { inline-size: var(--option-control-size); block-size: var(--option-control-size); border-color: var(--color-border-subtle); background: var(--color-background-elevated); --icon-button-color: var(--color-text-secondary); }
  .add { justify-self: start; }
  .form { display: grid; gap: var(--spacing-12); padding: var(--spacing-16); background: var(--color-surface-secondary); border: 1px solid var(--color-border-subtle); border-radius: var(--border-radius-10); }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-12); }
  .formActions { display: flex; justify-content: flex-end; gap: var(--spacing-8); }
  .error { color: var(--color-danger-primary); }
  .announcement { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }

  @media (pointer: coarse) {
    .component { --option-control-size: var(--layout-touch-target); }
  }

  @container (width < 24rem) {
    .tableHead { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--spacing-4) var(--spacing-8); padding: var(--spacing-12); }
    .row:first-child { border-block-start: none; }
    .name, .slug, .usage { grid-column: 1; padding: 0; }
    .controls { grid-column: 2; grid-row: 1 / 4; align-self: center; padding: 0; }
    .usageUnit { display: inline; }
    .fields { grid-template-columns: minmax(0, 1fr); }
    .form { padding: var(--spacing-12); }
    .formActions { flex-wrap: wrap; }
  }
</style>
