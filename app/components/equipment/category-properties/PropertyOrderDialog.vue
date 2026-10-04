<template>
  <ModalDialog v-model="opened" :class="$style.component" :aria-labelledby="headingId" :close-disabled="closeDisabled">
    <div ref="surface" :class="$style.surface">
      <header :class="$style.header">
        <div><h2 :id="headingId" :class="$style.heading">Reorder characteristics</h2><p :class="$style.hint">Drag to change the order, or use the arrow buttons.</p></div>
        <PerdIconButton icon="hugeicons:cancel-01" label="Close reordering" :disabled="saving" :class="$style.close" @click="close" />
      </header>
      <p :class="$style.announcement" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
      <ol ref="list" :class="$style.list" aria-label="Characteristic order" :aria-busy="saving">
        <li v-for="row in rows" :key="row.property.id" :data-order-id="row.property.id" :class="[$style.row, { dragging: row.dragging }]" tabindex="-1">
          <PerdIconButton icon="hugeicons:drag-drop-vertical" :label="row.dragLabel" :disabled="busy" :class="$style.grip" @pointerdown="startDrag(row.property.id, $event)" @pointermove="dragMove" @pointerup="endDrag" @pointercancel="cancelDrag" @lostpointercapture="cancelDrag" />
          <span :class="$style.position">{{ row.position }}</span>
          <div :class="$style.identity"><h3 :class="$style.name">{{ row.property.name }}</h3><span :class="$style.type">{{ row.typeLabel }}</span></div>
          <div :class="$style.arrows">
            <PerdIconButton icon="hugeicons:arrow-up-01" :label="row.upLabel" :disabled="row.upDisabled" :class="$style.control" @click="moveProperty(row.property.id, -1)" />
            <PerdIconButton icon="hugeicons:arrow-down-01" :label="row.downLabel" :disabled="row.downDisabled" :class="$style.control" @click="moveProperty(row.property.id, 1)" />
          </div>
        </li>
        <li v-if="showIndicator" :class="$style.indicator" :style="indicatorStyle" aria-hidden="true" data-testid="order-drop-indicator" />
      </ol>
      <p v-if="errorMessage" :class="$style.error" role="alert">{{ errorMessage }}</p>
      <footer :class="$style.footer">
        <span :class="$style.hint">{{ statusLabel }}</span>
        <div :class="$style.buttons"><PerdButton size="small" variant="secondary" :disabled="saving" @click="close">Cancel</PerdButton><PerdButton size="small" :disabled="saveDisabled" :loading="saving" @click="save">Save order</PerdButton></div>
      </footer>
      <div v-if="draggedProperty" :class="$style.preview" :style="previewStyle" aria-hidden="true" data-testid="order-drag-preview">
        <Icon name="hugeicons:drag-drop-vertical" :class="$style.previewIcon" /><div><strong :class="$style.previewName">{{ draggedProperty.name }}</strong><p :class="$style.type">{{ draggedType }}</p></div>
      </div>
    </div>
  </ModalDialog>
  <ConfirmationDialog v-model="leaveOpen" header-text="Discard order changes" confirm-button-text="Discard" @confirm="confirmLeave">Leave this page and discard the unsaved characteristic order?</ConfirmationDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
  import { useRequestFetch } from '#imports'

  import type {
    AdminCategoryProperty,
    AdminCategoryPropertiesSnapshot
  } from '#server/utils/equipment/category-properties'

  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdIconButton from '~/components/PerdIconButton.vue'
  import { useCategoryPropertyOrder } from '~/composables/use-category-property-order'
  import { getFetchErrorResponse } from '~/utils/fetch-error'

  interface Props {
    categoryId: number;
    properties: AdminCategoryProperty[];
    revision: number;
  }
  interface Emits {
    saved: [snapshot: AdminCategoryPropertiesSnapshot];
    conflict: [];
  }

  function typeLabel(property: AdminCategoryProperty) {
    if (property.dataType === 'enum') {
      const label = `Enum · ${property.enumOptions.length} options`

      return label
    }

    const firstLetter = property.dataType.charAt(0)
    const capitalizedFirstLetter = firstLetter.toUpperCase()
    const remainingLetters = property.dataType.slice(1)
    const capitalizedType = capitalizedFirstLetter + remainingLetters
    const label = property.unit ? `${capitalizedType} · ${property.unit}` : capitalizedType

    return label
  }

  const { categoryId, properties, revision } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const opened = defineModel<boolean>({ required: true })
  const headingId = useId()
  const list = useTemplateRef('list')
  const surface = useTemplateRef('surface')
  const requestFetch = useRequestFetch()
  const saving = ref(false)
  const conflict = ref(false)
  const errorMessage = ref('')
  const expectedRevision = ref(revision)
  const source = computed(() => properties)
  const busy = computed(() => saving.value || conflict.value)

  const {
    leaveOpen, confirmLeave, draftIds, orderDirty, orderedProperties, announcement,
    cancelOrder, moveProperty, startDrag, dragMove, endDrag, cancelDrag,
    dragging, draggedId, draggedProperty, showIndicator, indicatorStyle, previewStyle
  } = useCategoryPropertyOrder({
    properties: source,
    busy,
    list,
    surface
  })

  const saveDisabled = computed(() => !orderDirty.value || busy.value || dragging.value)
  const closeDisabled = computed(() => saving.value || dragging.value)
  const statusLabel = computed(() => orderDirty.value ? 'Order not saved' : 'Order saved')
  const draggedType = computed(() => draggedProperty.value ? typeLabel(draggedProperty.value) : '')

  const rows = computed(() => orderedProperties.value.map((property, index) => {
    return {
      property,
      position: index + 1,
      typeLabel: typeLabel(property),
      dragging: draggedId.value === property.id,
      dragLabel: `Drag ${property.name} to reorder`,
      upLabel: `Move ${property.name} up`,
      downLabel: `Move ${property.name} down`,
      upDisabled: busy.value || dragging.value || index === 0,
      downDisabled: busy.value || dragging.value || index === orderedProperties.value.length - 1
    }
  }))

  function close() {
    if (!saving.value) { opened.value = false }
  }

  async function save() {
    if (saveDisabled.value) { return }

    saving.value = true
    errorMessage.value = ''

    try {
      const result = await requestFetch(`/api/equipment/categories/${categoryId}/properties/order`, {
        method: 'PATCH',

        body: {
          expectedPropertiesRevision: expectedRevision.value,
          propertyIds: draftIds.value
        }
      })

      emit('saved', result)

      opened.value = false
    } catch (error) {
      const { status } = getFetchErrorResponse(error)

      if (status === 409) {
        conflict.value = true

        emit('conflict')

        errorMessage.value = 'The list changed. Your draft is still here. Cancel and reload characteristics before trying again.'
      } else {
        errorMessage.value = 'Could not save the order. Your draft is still here. Try again.'
      }
    } finally {
      saving.value = false
    }
  }

  watch(opened, async (value) => {
    await cancelOrder()

    if (value) {
      expectedRevision.value = revision
      conflict.value = false
      errorMessage.value = ''
      announcement.value = ''

      await nextTick()
      list.value?.querySelector<HTMLElement>('[data-order-id]')?.focus()
    }
  })
</script>

<style module>
  .component {
    inline-size: min(100dvw - var(--spacing-32), 40rem);
    max-inline-size: none;
    max-block-size: calc(100dvb - var(--spacing-32));
    overflow: visible;

    &[open]::backdrop { backdrop-filter: none; }
  }

  .surface {
    --order-control-size: var(--spacing-40);

    container-type: inline-size;
    position: relative;
    display: flex;
    flex-direction: column;
    max-block-size: calc(100dvb - var(--spacing-32));
    background: var(--color-surface-primary);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-10);
    box-shadow: var(--shadow-large);
  }

  .header { display: flex; justify-content: space-between; gap: var(--spacing-12); padding: var(--spacing-20); }
  .heading { font-size: var(--font-size-20); }
  .hint, .type, .position { color: var(--color-text-secondary); font-size: var(--font-size-14); }
  .list { position: relative; min-block-size: 0; overflow: auto; overscroll-behavior: contain; list-style: none; margin: 0 var(--spacing-20); padding: var(--spacing-4); border: 1px solid var(--color-border-subtle); border-radius: var(--border-radius-6); }
  .row { display: grid; grid-template-columns: var(--order-control-size) 1.25rem minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-12); padding: var(--spacing-8); overflow-wrap: anywhere; }
  .row + .row { border-block-start: 1px solid var(--color-border-subtle); }
  .row:focus-visible { outline: 2px solid var(--color-accent-primary); outline-offset: -2px; border-radius: var(--border-radius-6); }
  .row:global(.dragging) { opacity: 0.4; }
  .identity { display: grid; grid-template-columns: minmax(0, 1fr) minmax(8rem, 0.8fr); align-items: center; gap: var(--spacing-16); min-inline-size: 0; }
  .name { font-size: var(--font-size-14); font-weight: var(--font-weight-medium); }
  .position { font-variant-numeric: tabular-nums; }
  .grip, .control, .close { inline-size: var(--order-control-size); block-size: var(--order-control-size); }
  .control, .close { flex: none; --icon-button-color: var(--color-text-secondary); }
  .grip { touch-action: none; cursor: grab; --icon-button-icon-size: var(--font-size-24); --icon-button-color: var(--color-text-primary); --icon-button-background-hover: transparent; --icon-button-border-hover: transparent; }
  .grip:active { cursor: grabbing; }
  .arrows { display: flex; gap: var(--spacing-8); }
  .control { border-color: var(--color-border-subtle); background: var(--color-background-elevated); }
  .indicator { position: absolute; inset-inline: var(--spacing-4); block-size: 2px; background: var(--color-accent-primary); pointer-events: none; z-index: 1; translate: 0 -50%; }
  .indicator::before, .indicator::after { content: ''; position: absolute; top: 50%; translate: 0 -50%; inline-size: var(--spacing-8); block-size: var(--spacing-8); background: inherit; border-radius: 50%; }
  .indicator::before { inset-inline-start: 0; }
  .indicator::after { inset-inline-end: 0; }
  .preview { position: absolute; z-index: 2; display: flex; align-items: center; gap: var(--spacing-12); inline-size: min(16rem, 100% - var(--spacing-32)); padding: var(--spacing-12); border: 1px solid var(--color-border-strong); border-radius: var(--border-radius-6); background: var(--color-background-elevated); box-shadow: var(--shadow-medium); pointer-events: none; overflow-wrap: anywhere; font-size: var(--font-size-14); }
  .previewName { font-weight: var(--font-weight-medium); }
  .previewIcon { flex: none; font-size: var(--font-size-24); }
  .footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spacing-12); flex: none; margin-block-start: var(--spacing-20); padding: var(--spacing-16) var(--spacing-20); border-block-start: 1px solid var(--color-border-subtle); }
  .buttons { display: flex; gap: var(--spacing-12); margin-inline-start: auto; }
  .error { color: var(--color-danger-primary); padding: var(--spacing-12) var(--spacing-20) 0; }
  .announcement { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }

  @container (width < 36rem) {
    .identity { grid-template-columns: minmax(0, 1fr); gap: 0; }
  }

  @media (pointer: coarse), (width < 600px) {
    .surface { --order-control-size: var(--layout-touch-target); }
  }

  @media (width < 600px) {
    .component { --dialog-open-inline-translate: 0; --dialog-closed-inline-translate: 0; left: 0; right: 0; inline-size: auto; max-block-size: 100dvb; }
    .surface { max-block-size: 100dvb; border-radius: 0; padding-block-end: var(--layout-safe-bottom); }
    .header { padding: var(--spacing-16); }
    .list { margin-inline: var(--spacing-8); }
    .row { grid-template-columns: var(--order-control-size) minmax(0, 1fr) auto; gap: var(--spacing-8); padding-inline: 0; }
    .position { display: none; }
    .footer { padding: var(--spacing-16); }
  }
</style>
