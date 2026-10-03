<template>
  <div :class="$style.component">
    <PerdIconButton
      ref="trigger"
      icon="hugeicons:more-horizontal"
      :label="label"
      :title="label"
      :class="$style.trigger"
      :disabled="triggerDisabled"
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
      <template v-for="item in items" :key="item.id">
        <div v-if="item.separator" role="separator" :class="$style.separator" />
        <PerdButton
          :to="item.to"
          :icon="item.icon"
          :aria-disabled="item.disabled"
          :title="item.hint"
          variant="ghost"
          role="menuitem"
          tabindex="-1"
          :class="[$style.item, { danger: item.danger }]"
          @click.capture="select(item, $event)"
        >{{ item.label }}</PerdButton>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
  export interface ActionMenuItem {
    id: string;
    label: string;
    icon: string;
    to?: string;
    disabled?: boolean;
    hint?: string;
    danger?: boolean;
    separator?: boolean;
  }
</script>

<script setup lang="ts">
  import { computed, ref, useId, useTemplateRef } from 'vue'
  import { useEventListener, useMounted } from '@vueuse/core'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdIconButton from '~/components/PerdIconButton.vue'

  interface Props {
    label: string;
    menuLabel: string;
    items: ActionMenuItem[];
    disabled?: boolean;
  }

  interface Emits {
    action: [id: string];
  }

  const { disabled } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const menuId = useId()
  const isMounted = useMounted()
  const trigger = useTemplateRef('trigger')
  const menu = useTemplateRef('menu')
  const isOpen = ref(false)
  const menuLeft = ref(0)
  const menuTop = ref(0)
  const triggerDisabled = computed(() => disabled || !isMounted.value)

  const menuPosition = computed(() => {
    return {
      left: `${menuLeft.value}px`,
      top: `${menuTop.value}px`
    }
  })

  function positionMenu() {
    const panel = menu.value
    const button: unknown = trigger.value?.$el

    if (panel === null || !panel.matches(':popover-open') || !(button instanceof globalThis.HTMLElement)) {
      return
    }

    const anchor = button.getBoundingClientRect()
    const popup = panel.getBoundingClientRect()
    const gap = 8
    const maximumLeft = globalThis.window.innerWidth - popup.width - gap
    const maximumTop = globalThis.window.innerHeight - popup.height - gap
    const preferredLeft = anchor.right - popup.width
    const preferredTop = anchor.bottom + gap
    const boundedLeft = Math.min(preferredLeft, maximumLeft)
    const boundedTop = Math.min(preferredTop, maximumTop)

    menuLeft.value = Math.max(gap, boundedLeft)
    menuTop.value = Math.max(gap, boundedTop)
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

      const elements = menuItems()

      elements[0]?.focus({ preventScroll: true })
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
      positionMenu()
    }
  }

  function select(item: ActionMenuItem, event: MouseEvent) {
    if (item.disabled) {
      event.preventDefault()
      event.stopImmediatePropagation()

      return
    }

    close()
    emit('action', item.id)
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      menu.value?.showPopover()
      positionMenu()

      const elements = menuItems()
      const target = event.key === 'ArrowUp' ? elements.at(-1) : elements[0]

      target?.focus()
    }
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    const elements = menuItems()
    const { activeElement } = globalThis.document
    const currentIndex = activeElement instanceof globalThis.HTMLElement ? elements.indexOf(activeElement) : -1
    let targetIndex: number | null = null

    if (event.key === 'ArrowDown') {
      targetIndex = (currentIndex + 1) % elements.length
    } else if (event.key === 'ArrowUp') {
      targetIndex = (currentIndex - 1 + elements.length) % elements.length
    } else if (event.key === 'Home') {
      targetIndex = 0
    } else if (event.key === 'End') {
      targetIndex = elements.length - 1
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
      elements[targetIndex]?.focus()
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

  .item {
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

    &[aria-disabled='true']:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: -2px;
    }
  }

  .separator {
    block-size: 1px;
    margin-block: var(--spacing-4);
    background: var(--color-border-subtle);
  }

  .item {
    &:global(.danger) {
      --button-background-hover: var(--color-danger-subtle);
      --button-background-active: var(--color-danger-subtle-hover);
      --button-text-color: color-mix(in oklab, var(--color-danger-primary) 75%, var(--color-text-primary));
    }
  }
</style>
