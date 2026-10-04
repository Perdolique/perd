import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useEventListener, useRafFn } from '@vueuse/core'
import type { AdminCategoryProperty } from '#server/utils/equipment/category-properties'

interface DragSession {
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  target: HTMLElement;
}

interface Options {
  properties: Ref<AdminCategoryProperty[]>;
  busy: Ref<boolean>;
  list: Readonly<Ref<HTMLElement | null>>;
  surface: Readonly<Ref<HTMLElement | null>>;
}

/** Keeps the order draft separate from the pointer's proposed drop position. */
function useCategoryPropertyOrder({ properties, busy, list, surface }: Options) {
  const draftIds = ref<number[]>([])
  const announcement = ref('')
  const leaveOpen = ref(false)
  const draggedId = ref<number | null>(null)
  const dropIndex = ref<number | null>(null)
  const indicatorTop = ref(0)
  const previewLeft = ref(0)
  const previewTop = ref(0)
  let resolveLeave: ((allowed: boolean) => void) | null = null
  let session: DragSession | null = null
  let pointerX = 0
  let pointerY = 0
  let lastMovedId: number | null = null
  const savedIds = computed(() => properties.value.map((property) => property.id))
  const orderDirty = computed(() => draftIds.value.some((id, index) => id !== savedIds.value[index]))
  const dragging = computed(() => draggedId.value !== null)
  const draggedProperty = computed(() => properties.value.find((property) => property.id === draggedId.value))
  const showIndicator = computed(() => dropIndex.value !== null)
  const indicatorStyle = computed(() => { return { top: `${indicatorTop.value}px` } })

  const previewStyle = computed(() => {
    return {
      left: `${previewLeft.value}px`,
      top: `${previewTop.value}px`
    }
  })

  const orderedProperties = computed(() => {
    const propertyEntries = properties.value.map((property): [number, AdminCategoryProperty] => [property.id, property])
    const byId = new Map(propertyEntries)

    return draftIds.value.flatMap((id) => {
      const property = byId.get(id)

      return property === undefined ? [] : [property]
    })
  })

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

    const row = list.value?.querySelector<HTMLElement>(`[data-order-id="${id}"]`)

    row?.focus({ preventScroll: true })
    row?.scrollIntoView({ block: 'nearest' })
  }

  async function moveProperty(id: number, offset: number) {
    const index = draftIds.value.indexOf(id) + offset

    await moveTo(id, index)
  }

  function updateDestination() {
    const container = list.value

    if (container === null || draggedId.value === null) {
      return
    }

    const bounds = container.getBoundingClientRect()
    const outside = pointerX < bounds.left || pointerX > bounds.right || pointerY < bounds.top || pointerY > bounds.bottom

    if (outside) {
      dropIndex.value = null

      return
    }

    const elements = container.querySelectorAll<HTMLElement>('[data-order-id]')
    const candidates = [...elements].filter((row) => Number(row.dataset.orderId) !== draggedId.value)

    const beforeIndex = candidates.findIndex((row) => {
      const rectangle = row.getBoundingClientRect()

      return pointerY < rectangle.top + rectangle.height / 2
    })

    const index = beforeIndex === -1 ? candidates.length : beforeIndex
    const before = candidates[index]
    const edge = before?.getBoundingClientRect().top ?? candidates.at(-1)?.getBoundingClientRect().bottom

    dropIndex.value = index === draftIds.value.indexOf(draggedId.value) ? null : index
    indicatorTop.value = (edge ?? bounds.top) - bounds.top + container.scrollTop
  }

  const { pause, resume } = useRafFn(({ delta }) => {
    const container = list.value

    if (container === null || draggedId.value === null) {
      return
    }

    const bounds = container.getBoundingClientRect()

    if (pointerX < bounds.left || pointerX > bounds.right || pointerY < bounds.top || pointerY > bounds.bottom) {
      return
    }

    const edge = 44

    const distance = pointerY < bounds.top + edge
      ? pointerY - bounds.top - edge
      : Math.max(0, pointerY - bounds.bottom + edge)

    const previous = container.scrollTop

    container.scrollTop += distance * Math.min(delta, 32) / 80

    if (container.scrollTop !== previous) {
      updateDestination()
    }
  }, { immediate: false })

  function cancelDrag() {
    const previous = session

    session = null
    draggedId.value = null
    dropIndex.value = null

    pause()

    if (previous?.target.hasPointerCapture(previous.pointerId) === true) {
      previous.target.releasePointerCapture(previous.pointerId)
    }
  }

  function startDrag(id: number, event: PointerEvent) {
    if (busy.value || !event.isPrimary || event.button !== 0 || !(event.currentTarget instanceof globalThis.HTMLElement)) {
      return
    }

    cancelDrag()

    session = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target: event.currentTarget
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function dragMove(event: PointerEvent) {
    if (session === null || event.pointerId !== session.pointerId || surface.value === null) {
      return
    }

    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY)

    if (draggedId.value === null && distance < 5) {
      return
    }

    if (draggedId.value === null) {
      draggedId.value = session.id

      resume()
    }

    pointerX = event.clientX
    pointerY = event.clientY

    const bounds = surface.value.getBoundingClientRect()
    const previewWidth = Math.min(256, bounds.width - 32)
    const maximumLeft = bounds.width - previewWidth - 8
    const maximumTop = bounds.height - 80
    const preferredLeft = pointerX - bounds.left - previewWidth / 2
    const preferredTop = pointerY - bounds.top - 32
    const boundedLeft = Math.min(preferredLeft, maximumLeft)
    const boundedTop = Math.min(preferredTop, maximumTop)

    previewLeft.value = Math.max(8, boundedLeft)
    previewTop.value = Math.max(8, boundedTop)

    updateDestination()
  }

  async function endDrag(event: PointerEvent) {
    if (session === null || event.pointerId !== session.pointerId) {
      return
    }

    const id = draggedId.value
    const index = dropIndex.value

    cancelDrag()

    if (id !== null && index !== null) {
      await moveTo(id, index)
    }
  }

  async function cancelOrder() {
    cancelDrag()

    draftIds.value = savedIds.value
    announcement.value = 'Order changes cancelled.'

    await nextTick()
    list.value?.querySelector<HTMLElement>(`[data-order-id="${lastMovedId}"]`)?.focus({ preventScroll: true })
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && session !== null) {
      event.preventDefault()
      event.stopImmediatePropagation()
      cancelDrag()

      announcement.value = 'Drag cancelled.'
    }
  }

  useEventListener(() => globalThis.document, 'keydown', handleKeydown, { capture: true })
  useEventListener(() => globalThis.window, 'blur', cancelDrag)

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
    cancelDrag,
    dragging,
    draggedId,
    draggedProperty,
    showIndicator,
    indicatorStyle,
    previewStyle
  }
}

export { useCategoryPropertyOrder }
