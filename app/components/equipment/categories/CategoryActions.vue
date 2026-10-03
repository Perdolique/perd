<template>
  <div :class="$style.component">
    <PerdIconButton
      ref="trigger"
      icon="hugeicons:more-horizontal"
      :label="triggerLabel"
      :title="triggerLabel"
      :class="$style.trigger"
      :disabled="!isMounted"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-controls="menuId"
      :popovertarget="menuId"
      @click.prevent="toggleMenu"
      @keydown="handleTriggerKeydown"
    />
    <div
      :id="menuId"
      ref="menu"
      popover
      role="menu"
      :aria-label="menuLabel"
      :class="$style.menu"
      :style="menuPosition"
      @toggle="handleToggle"
      @keydown="handleMenuKeydown"
    >
      <PerdButton :to="propertiesPath" icon="hugeicons:sliders-horizontal" variant="ghost" role="menuitem" tabindex="-1" autofocus :class="$style.item" @click="close">Characteristics</PerdButton>
      <PerdButton icon="hugeicons:pencil-edit-02" variant="ghost" role="menuitem" tabindex="-1" :class="$style.item" @click="editCategory">Edit</PerdButton>
      <div role="separator" :class="$style.separator" />
      <PerdButton icon="hugeicons:delete-02" variant="ghost" role="menuitem" tabindex="-1" :class="$style.deleteItem" @click="deleteCategory">Delete</PerdButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, useId, useTemplateRef } from 'vue'
  import { useEventListener, useMounted } from '@vueuse/core'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdIconButton from '~/components/PerdIconButton.vue'

  interface Props {
    categoryName: string;
    propertiesPath: string;
  }

  interface Emits {
    edit: [];
    delete: [];
  }

  const { categoryName, propertiesPath } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const menuId = useId()
  const isMounted = useMounted()
  const trigger = useTemplateRef('trigger')
  const menu = useTemplateRef('menu')
  const isOpen = ref(false)
  const menuLeft = ref(0)
  const menuTop = ref(0)
  const triggerLabel = computed(() => `Actions for ${categoryName}`)
  const menuLabel = computed(() => `${categoryName} actions`)

  const menuPosition = computed(() => {
    return {
      left: `${menuLeft.value}px`,
      top: `${menuTop.value}px`
    }
  })

  function positionMenu() {
    const panel = menu.value
    const button: unknown = trigger.value?.$el

    if (panel === null || !(button instanceof globalThis.HTMLElement)) {
      return
    }

    const anchor = button.getBoundingClientRect()
    const popup = panel.getBoundingClientRect()
    const gap = 8
    const maximumLeft = globalThis.window.innerWidth - popup.width - gap
    const maximumTop = globalThis.window.innerHeight - popup.height - gap

    menuLeft.value = Math.max(gap, Math.min(anchor.right - popup.width, maximumLeft))
    menuTop.value = Math.max(gap, Math.min(anchor.bottom + gap, maximumTop))
  }

  function menuItems() {
    const elements = menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []

    return [...elements]
  }

  function handleToggle(event: ToggleEvent) {
    isOpen.value = event.newState === 'open'
  }

  function toggleMenu() {
    const panel = menu.value

    panel?.togglePopover()

    if (panel?.matches(':popover-open')) {
      positionMenu()
    }
  }

  function close() {
    if (!menu.value?.matches(':popover-open')) {
      return
    }

    menu.value?.hidePopover()

    const button: unknown = trigger.value?.$el

    if (button instanceof globalThis.HTMLElement) {
      button.focus({ preventScroll: true })
    }
  }

  function handleScroll(event: Event) {
    if (!(event.target instanceof globalThis.Node) || !menu.value?.contains(event.target)) {
      close()
    }
  }

  function editCategory() {
    close()
    emit('edit')
  }

  function deleteCategory() {
    close()
    emit('delete')
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      menu.value?.showPopover()
      positionMenu()

      const items = menuItems()
      const target = event.key === 'ArrowUp' ? items.at(-1) : items[0]

      target?.focus()
    }
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    const items = menuItems()
    const { activeElement } = globalThis.document
    const currentIndex = activeElement instanceof globalThis.HTMLElement ? items.indexOf(activeElement) : -1
    let targetIndex: number | null = null

    if (event.key === 'ArrowDown') {
      targetIndex = (currentIndex + 1) % items.length
    } else if (event.key === 'ArrowUp') {
      targetIndex = (currentIndex - 1 + items.length) % items.length
    } else if (event.key === 'Home') {
      targetIndex = 0
    } else if (event.key === 'End') {
      targetIndex = items.length - 1
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      close()

      if (event.key === 'Escape') {
        event.preventDefault()
      }

      return
    } else if (event.key === ' ' && globalThis.document.activeElement instanceof globalThis.HTMLAnchorElement) {
      event.preventDefault()
      globalThis.document.activeElement.click()

      return
    }

    if (targetIndex !== null) {
      event.preventDefault()
      items[targetIndex]?.focus()
    }
  }

  useEventListener(() => globalThis.window, 'resize', close)
  useEventListener(() => globalThis.window, 'scroll', handleScroll, { capture: true })
</script>

<style module>
  .component {
    --action-target-size: var(--spacing-40);

    display: flex;
    align-items: center;

    @media (pointer: coarse) {
      --action-target-size: var(--layout-touch-target);
    }
  }

  .trigger {
    --icon-button-color: var(--color-text-secondary);
    --icon-button-background-hover: var(--color-accent-subtle);

    inline-size: var(--action-target-size);
    block-size: var(--action-target-size);
    border-color: var(--color-border-subtle);
    border-radius: var(--border-radius-10);
    background: var(--color-surface-primary);

    &[aria-expanded='true'] {
      background: var(--color-accent-subtle);
      color: var(--color-text-primary);
    }
  }

  .menu {
    position: fixed;
    inset: auto;
    margin: 0;
    inline-size: min(14.5rem, 100dvw - var(--spacing-32));
    max-block-size: calc(100dvh - var(--spacing-32));
    overflow: auto;
    padding: 0.375rem;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-10);
    background: var(--color-surface-primary);
    box-shadow: var(--shadow-medium);

    &:popover-open {
      display: grid;
    }
  }

  .item,
  .deleteItem {
    justify-content: start;
    gap: var(--spacing-12);
    min-block-size: var(--action-target-size);
    padding-inline: var(--spacing-12);
    border-radius: var(--border-radius-6);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-regular);

    &:global(.ghost) {
      --button-border-color-hover: transparent;
    }
  }

  .separator {
    block-size: 1px;
    margin-block: var(--spacing-4);
    background: var(--color-border-subtle);
  }

  .deleteItem {
    &:global(.ghost) {
      --button-background-hover: var(--color-danger-subtle);
      --button-background-active: var(--color-danger-subtle-hover);
      --button-text-color: color-mix(in oklab, var(--color-danger-primary) 75%, var(--color-text-primary));
    }
  }
</style>
