<template>
  <li :class="$style.component" :data-property-id="property.id" tabindex="-1">
    <div :class="$style.heading">
      <div :class="$style.identity">
        <h2 :class="$style.name">{{ property.name }}</h2>
        <p :class="$style.metadata">{{ property.slug }} · {{ typeLabel }} · {{ property.usedItemCount }} items</p>
      </div>
      <div :class="$style.actions">
        <button type="button" :class="$style.drag" :disabled="busy" :aria-label="dragLabel" @pointerdown="startDrag" @pointermove="emit('dragMove', $event)" @pointerup="emit('dragEnd', $event)" @pointercancel="emit('dragCancel', $event)">⠿</button>
        <PerdButton size="small" variant="secondary" :disabled="upDisabled" :aria-label="upLabel" @click="emit('move', property.id, -1)">Up</PerdButton>
        <PerdButton size="small" variant="secondary" :disabled="downDisabled" :aria-label="downLabel" @click="emit('move', property.id, 1)">Down</PerdButton>
        <PerdButton size="small" variant="secondary" :disabled="editsDisabled" :aria-label="editLabel" @click="emit('edit', property)">Edit</PerdButton>
        <PerdButton size="small" variant="danger" :disabled="editsDisabled" :aria-label="deleteLabel" @click="emit('delete', property)">Delete</PerdButton>
      </div>
    </div>
    <details v-if="isEnum" :class="$style.options">
      <summary>Options ({{ property.enumOptions.length }})</summary>
      <ul :class="$style.optionList">
        <li v-for="option in optionRows" :key="option.id" :class="$style.option">
          <div :class="$style.identity"><strong>{{ option.name }}</strong><p :class="$style.metadata">{{ option.slug }} · {{ option.usedItemCount }} items</p></div>
          <div :class="$style.actions">
            <PerdButton size="small" variant="secondary" :disabled="editsDisabled" :aria-label="option.editLabel" @click="emit('editOption', property.id, option)">Edit</PerdButton>
            <PerdButton size="small" variant="danger" :disabled="option.deleteDisabled" :aria-label="option.deleteLabel" @click="emit('deleteOption', property.id, option)">Delete</PerdButton>
          </div>
          <p v-if="option.deleteReason" :class="$style.reason">{{ option.deleteReason }}</p>
        </li>
      </ul>
      <PerdButton size="small" variant="secondary" :disabled="editsDisabled" @click="emit('editOption', property.id, null)">Add option</PerdButton>
    </details>
  </li>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { AdminCategoryProperty, AdminPropertyOption } from '#server/utils/equipment/category-properties'
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    property: AdminCategoryProperty;
    index: number;
    total: number;
    busy: boolean;
    editsDisabled: boolean;
  }
  interface Emits {
    move: [id: number, offset: number];
    edit: [property: AdminCategoryProperty];
    delete: [property: AdminCategoryProperty];
    editOption: [propertyId: number, option: AdminPropertyOption | null];
    deleteOption: [propertyId: number, option: AdminPropertyOption];
    dragStart: [id: number, event: PointerEvent];
    dragMove: [event: PointerEvent];
    dragEnd: [event: PointerEvent];
    dragCancel: [event: PointerEvent];
  }

  const { property, index, total, busy, editsDisabled } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const upDisabled = computed(() => busy || index === 0)
  const downDisabled = computed(() => busy || index === total - 1)
  const isEnum = computed(() => property.dataType === 'enum')
  const typeLabel = computed(() => property.unit ? `${property.dataType} (${property.unit})` : property.dataType)
  const upLabel = computed(() => `Move ${property.name} up`)
  const downLabel = computed(() => `Move ${property.name} down`)
  const dragLabel = computed(() => `Drag ${property.name} to reorder`)
  const editLabel = computed(() => `Edit ${property.name}`)
  const deleteLabel = computed(() => `Delete ${property.name}`)

  const optionRows = computed(() => property.enumOptions.map((option) => {
    let deleteReason = ''

    if (option.usedItemCount > 0) {
      deleteReason = 'Used by items. Cannot delete.'
    } else if (property.enumOptions.length === 1) {
      deleteReason = 'Keep at least one option.'
    }

    return {
      id: option.id,
      name: option.name,
      slug: option.slug,
      usedItemCount: option.usedItemCount,
      editLabel: `Edit option ${option.name}`,
      deleteLabel: `Delete option ${option.name}`,
      deleteDisabled: editsDisabled || deleteReason !== '',
      deleteReason
    }
  }))

  function startDrag(event: PointerEvent) {
    emit('dragStart', property.id, event)
  }
</script>

<style module>
  .component { container-type: inline-size; padding: var(--spacing-16); border: 1px solid var(--color-border-subtle); border-radius: var(--border-radius-16); background: var(--color-surface-secondary); overflow-wrap: anywhere; }
  .heading, .option { display: flex; align-items: start; justify-content: space-between; gap: var(--spacing-16); flex-wrap: wrap; }
  .identity { min-inline-size: 0; flex: 1 1 12rem; }
  .name { font-size: var(--font-size-18); }
  .metadata, .reason { color: var(--color-text-tertiary); }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-8); }
  .drag { touch-action: none; cursor: grab; font-size: var(--font-size-24); padding: var(--spacing-8); border: 1px solid var(--color-border-subtle); border-radius: var(--border-radius-8); color: var(--color-text-primary); background: var(--color-surface-primary); }
  .options { margin-block-start: var(--spacing-16); }
  .optionList { display: grid; gap: var(--spacing-16); padding-block: var(--spacing-16); list-style: none; }
  .reason { flex-basis: 100%; }
  @container (width < 32rem) { .actions { flex-basis: 100%; } }
</style>
