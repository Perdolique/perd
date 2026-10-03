import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import type { AdminCategoryProperty } from '#server/utils/equipment/category-properties'

/** Owns the order draft, pointer dragging, focus, and confirmation before leaving. */
function useCategoryPropertyOrder(properties: Ref<AdminCategoryProperty[]>, busy: Ref<boolean>) {
  const draftIds = ref<number[]>([])
  const announcement = ref('')
  const leaveOpen = ref(false)
  let resolveLeave: ((allowed: boolean) => void) | null = null
  const savedIds = computed(() => properties.value.map((property) => property.id))
  const orderDirty = computed(() => draftIds.value.some((id, index) => id !== savedIds.value[index]))

  const orderedProperties = computed(() => {
    const byId = new Map(properties.value.map((property) => [property.id, property]))

    return draftIds.value.flatMap((id) => {
      const property = byId.get(id)

      return property === undefined ? [] : [property]
    })
  })

  let draggedId: number | null = null
  let pointerId: number | null = null
  let dragStartIds: number[] = []
  let lastMovedId: number | null = null

  watch(savedIds, (ids) => {
    draftIds.value = ids
  }, { immediate: true })

  async function moveTo(id: number, index: number) {
    const previous = draftIds.value.indexOf(id)

    if (busy.value || previous === -1 || previous === index || index < 0 || index >= draftIds.value.length) {
      return
    }

    const reordered = draftIds.value.filter((entry) => entry !== id)

    reordered.splice(index, 0, id)

    draftIds.value = reordered
    lastMovedId = id

    const property = properties.value.find((entry) => entry.id === id)

    announcement.value = `${property?.name ?? 'Characteristic'} moved to position ${index + 1} of ${reordered.length}.`

    await nextTick()
    globalThis.document.querySelector<HTMLElement>(`[data-property-id="${id}"]`)?.focus({ preventScroll: true })
  }
  async function moveProperty(id: number, offset: number) {
    const index = draftIds.value.indexOf(id) + offset

    await moveTo(id, index)
  }
  async function cancelOrder() {
    draftIds.value = savedIds.value
    announcement.value = 'Order changes cancelled.'

    await nextTick()
    globalThis.document.querySelector<HTMLElement>(`[data-property-id="${lastMovedId}"]`)?.focus({ preventScroll: true })
  }
  function startDrag(id: number, event: PointerEvent) {
    if (busy.value || !event.isPrimary || event.button !== 0) {
      return
    }

    const target = event.currentTarget

    if (!(target instanceof globalThis.HTMLElement)) {
      return
    }

    draggedId = id

    const { pointerId: activePointerId } = event

    pointerId = activePointerId
    dragStartIds = draftIds.value

    target.setPointerCapture(event.pointerId)
  }
  async function dragMove(event: PointerEvent) {
    if (draggedId === null || event.pointerId !== pointerId) {
      return
    }

    const target = globalThis.document.elementFromPoint(event.clientX, event.clientY)
    const row = target?.closest<HTMLElement>('[data-property-id]')
    const targetId = Number(row?.dataset.propertyId)
    const index = draftIds.value.indexOf(targetId)

    if (index !== -1) {
      await moveTo(draggedId, index)
    }
  }
  function endDrag(event: PointerEvent) {
    if (event.pointerId === pointerId) {
      draggedId = null
      pointerId = null
    }
  }
  function cancelDrag(event: PointerEvent) {
    if (event.pointerId === pointerId) {
      draftIds.value = dragStartIds

      endDrag(event)

      announcement.value = 'Drag cancelled.'
    }
  }

  onBeforeRouteLeave(async () => {
    if (busy.value && orderDirty.value) {
      return false
    }

    if (!orderDirty.value) {
      return true
    }

    leaveOpen.value = true

    // oxlint-disable-next-line promise/avoid-new -- The route guard waits for an explicit dialog decision.
    return new Promise<boolean>((resolve) => {
      resolveLeave = resolve
    })
  })

  function confirmLeave() {
    resolveLeave?.(true)

    resolveLeave = null
  }

  watch(leaveOpen, (open) => {
    if (!open) {
      resolveLeave?.(false)

      resolveLeave = null
    }
  })

  useEventListener(() => globalThis.window, 'beforeunload', (event) => {
    if (orderDirty.value) {
      event.preventDefault()
    }
  })

  return {
    leaveOpen,
    confirmLeave,
    draftIds,
    orderDirty,
    orderedProperties,
    announcement,
    cancelOrder,
    moveProperty,
    startDrag,
    dragMove,
    endDrag,
    cancelDrag
  }
}

export { useCategoryPropertyOrder }
