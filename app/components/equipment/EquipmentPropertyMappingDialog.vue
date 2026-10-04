<template>
  <ModalDialog v-model="isOpen" :aria-labelledby="headingId" :class="$style.component">
    <div :class="$style.content">
      <h2 :id="headingId">Change category</h2>
      <p>Choose where each value should go. Matching names may have different meanings. Nothing is saved until you save the item.</p>
      <p v-if="isLoading" role="status">Loading characteristics…</p>
      <div v-else-if="hasError" role="alert">
        <p>Could not load the new category. Your draft has not changed.</p>
        <PerdButton variant="secondary" @click="refresh()">Retry</PerdButton>
      </div>
      <template v-else-if="category">
        <p>From {{ sourceCategory.name }} to {{ category.name }}</p>
        <div v-for="row in rows" :key="row.id" :class="$style.row">
          <p><strong>{{ row.name }}</strong>: {{ row.valueLabel }}</p>
          <PerdSelect :label="row.selectLabel" :model-value="row.selected" :options="row.options" @update:model-value="row.setTarget" />
          <p v-if="row.hasNoMatch" :class="$style.hint">No compatible field. Types and units must match, and the new field must accept this value. Choose Do not transfer or cancel to correct the value.</p>
          <p>{{ row.summary }}</p>
        </div>
        <p role="status">{{ summary }}</p>
      </template>
      <div :class="$style.actions">
        <PerdButton variant="secondary" @click="close">Cancel</PerdButton>
        <PerdButton :disabled="isApplyDisabled" @click="apply">Apply mapping</PerdButton>
      </div>
    </div>
  </ModalDialog>
</template>

<script lang="ts" setup>
  import { computed, onScopeDispose, ref, useId, watch } from 'vue'
  import { useAsyncData, useRequestFetch } from '#imports'
  import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdSelect from '~/components/perd-select/PerdSelect.vue'

  import {
    applyEquipmentPropertyAssignments,
    canTransferEquipmentProperty,
    getEquipmentPropertySources,
    suggestEquipmentPropertyAssignments,
    type EquipmentPropertyAssignments
  } from '~/utils/equipment-property-mapping'

  interface Props {
    sourceCategory: CategoryDetailResponse;
    targetSlug: string;
    values: Record<number, unknown>;
  }

  interface Emits {
    apply: [category: CategoryDetailResponse, values: Record<number, boolean | string>];
  }

  const { sourceCategory, targetSlug, values } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isOpen = defineModel<boolean>({ required: true })
  const requestFetch = useRequestFetch()
  const headingId = useId()
  const sources = computed(() => getEquipmentPropertySources(sourceCategory.properties, values))
  const assignments = ref<EquipmentPropertyAssignments>({})

  const { data: category, error, status, refresh, clear } = useAsyncData('equipment-property-mapping', async (_app, { signal }): Promise<CategoryDetailResponse> => {
    const path = `/api/equipment/categories/by-slug/${targetSlug}` as const

    const response = await requestFetch(path, {
      method: 'get',
      signal
    })

    return response
  }, {
    immediate: false
  })

  const isLoading = computed(() => status.value === 'pending' || status.value === 'idle')
  const hasError = computed(() => error.value !== undefined && error.value !== null)
  const mappedValues = computed(() => category.value ? applyEquipmentPropertyAssignments(sources.value, category.value.properties, assignments.value) : null)
  const isApplyDisabled = computed(() => isLoading.value || hasError.value || mappedValues.value === null)

  const rows = computed(() => sources.value.map((source) => {
    const targets = category.value?.properties ?? []
    const compatible = targets.filter((target) => canTransferEquipmentProperty(source, target))
    const selected = assignments.value[source.property.id]
    let selectedValue = selected === undefined ? '' : `${selected}`

    if (selected === null) { selectedValue = 'discard' }

    const selectedTarget = targets.find((target) => target.id === selected)
    const booleanLabel = source.value === true ? 'Yes' : 'No'
    const rawLabel = typeof source.value === 'boolean' ? booleanLabel : source.value
    const optionName = source.property.enumOptions?.find((option) => option.slug === source.value)?.name
    const unitLabel = source.property.unit ? ` ${source.property.unit}` : ''
    const valueLabel = `${optionName ?? rawLabel}${unitLabel}`
    const assignmentEntries = Object.entries(assignments.value)

    const options = compatible.map((target) => {
      const isUsed = assignmentEntries.some(([sourceId, targetId]) => {
        const sourcePropertyId = Number(sourceId)

        return sourcePropertyId !== source.property.id && targetId === target.id
      })

      return {
        label: target.name,
        value: `${target.id}`,
        disabled: isUsed
      }
    })

    function setTarget(value: string) {
      if (value === '') {
        assignments.value[source.property.id] = undefined

        return
      }

      assignments.value[source.property.id] = value === 'discard' ? null : Number(value)
    }

    let summary = 'Choose a field or Do not transfer.'

    if (selected === null) { summary = `Will not transfer: ${valueLabel}` } else if (selectedTarget) { summary = `${valueLabel} → ${selectedTarget.name}` }

    return {
      id: source.property.id,
      name: source.property.name,
      valueLabel,
      selected: selectedValue,
      selectLabel: `Transfer ${source.property.name} to`,

      options: [{
        label: 'Choose a field',
        value: ''
      }, {
        label: 'Do not transfer',
        value: 'discard'
      }, ...options],

      hasNoMatch: compatible.length === 0,
      summary,
      setTarget
    }
  }))

  const summary = computed(() => {
    const assignmentValues = Object.values(assignments.value)
    const choices = assignmentValues.filter((value) => value !== undefined)
    const discarded = choices.filter((value) => value === null).length
    const transferred = choices.filter((value) => value !== null).length

    return `${transferred} to transfer, ${discarded} not transferred, ${sources.value.length - choices.length} to choose.`
  })

  function close() { isOpen.value = false }

  function apply() {
    const result = mappedValues.value
    const target = category.value

    if (isApplyDisabled.value || result === null || !target) { return }

    emit('apply', target, result)
    close()
  }

  watch(category, (target) => {
    if (!target || !isOpen.value || target.slug !== targetSlug) { return }

    assignments.value = suggestEquipmentPropertyAssignments(sources.value, target.properties)

    if (sources.value.length === 0) {
      emit('apply', target, {})
      close()
    }
  })

  watch(() => [isOpen.value, targetSlug], async () => {
    if (!isOpen.value) {
      clear()

      return
    }

    assignments.value = {}

    await refresh()
  }, { immediate: true })

  onScopeDispose(clear)
</script>

<style module>
  .component {
    inline-size: min(100dvw - var(--spacing-32), 42rem);
    max-inline-size: none;
  }

  .content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--spacing-24);
    padding: var(--spacing-24);
    background: var(--color-surface-primary);
    border-radius: var(--border-radius-24);
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--spacing-8);
    padding-block: var(--spacing-16);
    border-block-start: 1px solid var(--color-border-subtle);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--spacing-16);
  }

  .hint {
    color: var(--color-text-muted);
  }
</style>
