<template>
  <dialog
    ref="dialogRef"
    :class="[$style.component, { isBottomSheet, isSideSheet }]"
    :closedby="closedBy"
    @cancel="preventCloseWhenDisabled"
    @click="closeOnFallbackLightDismiss"
  >
    <slot />
  </dialog>
</template>

<script lang="ts" setup>
  import { computed, useTemplateRef, watchEffect } from 'vue'
  import { useEventListener } from '@vueuse/core'

  interface Props {
    closeDisabled?: boolean;
    desktopPresentation?: 'centered' | 'side-sheet';
    mobilePresentation?: 'bottom-sheet' | 'centered';
  }

  const {
    closeDisabled,
    desktopPresentation = 'centered',
    mobilePresentation = 'centered'
  } = defineProps<Props>()

  const dialogRef = useTemplateRef('dialogRef')
  let invokingElement: HTMLElement | null = null

  const isOpened = defineModel<boolean>({
    required: true
  })

  const closedBy = computed(() => closeDisabled ? 'none' : 'any')
  const isBottomSheet = computed(() => mobilePresentation === 'bottom-sheet')
  const isSideSheet = computed(() => desktopPresentation === 'side-sheet')

  function preventCloseWhenDisabled(event: Event) {
    if (closeDisabled) {
      event.preventDefault()
    }
  }

  function closeOnFallbackLightDismiss(event: MouseEvent) {
    const dialog = dialogRef.value

    if (dialog === null) {
      return
    }

    const supportsClosedBy = Reflect.has(dialog, 'closedBy')
    const isDialogTarget = event.target === dialog

    if (closeDisabled || supportsClosedBy || !isDialogTarget) {
      return
    }

    const bounds = dialog.getBoundingClientRect()
    const isWithinDialog = event.clientX >= bounds.left
      && event.clientX <= bounds.right
      && event.clientY >= bounds.top
      && event.clientY <= bounds.bottom

    if (!isWithinDialog) {
      dialog.close()
    }
  }

  watchEffect(() => {
    const dialog = dialogRef.value

    if (dialog === null) {
      return
    }

    if (isOpened.value) {
      if (dialog.open) {
        return
      }

      const { activeElement } = dialog.ownerDocument

      invokingElement = activeElement instanceof globalThis.HTMLElement ? activeElement : null
      dialog.showModal()

      return
    }

    if (dialog.open) {
      dialog.close()
    }
  })

  useEventListener(dialogRef, 'close', () => {
    const elementToRestore = invokingElement

    invokingElement = null
    isOpened.value = false

    if (elementToRestore?.isConnected === true) {
      elementToRestore.focus()
    }
  })
</script>

<style module>
  .component {
    --dialog-open-inline-translate: -50%;
    --dialog-closed-inline-translate: -50%;
    --dialog-closed-block-translate: 0.75rem;

    position: fixed;
    left: 50dvw;
    right: auto;
    padding: 0;
    border: none;
    margin-inline: 0;
    background: none;
    opacity: 0;
    translate: var(--dialog-closed-inline-translate) var(--dialog-closed-block-translate);
    transition:
      opacity var(--transition-duration-normal) var(--transition-easing-standard),
      translate var(--transition-duration-normal) var(--transition-easing-standard),
      overlay var(--transition-duration-normal) var(--transition-easing-standard) allow-discrete,
      display var(--transition-duration-normal) var(--transition-easing-standard) allow-discrete;

    &[open] {
      opacity: 1;
      translate: var(--dialog-open-inline-translate) 0;

      @starting-style {
        opacity: 0;
        translate: var(--dialog-closed-inline-translate) var(--dialog-closed-block-translate);
      }
    }

    &:global(.isBottomSheet) {
      @media (width < 900px) {
        --dialog-open-inline-translate: 0;
        --dialog-closed-inline-translate: 0;
        --dialog-closed-block-translate: 100%;

        left: 0;
        inset-block: auto 0;
        inline-size: 100dvw;
        max-inline-size: none;
        max-block-size: 90dvb;
        margin: 0;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable both-edges;
        padding-block-end: var(--layout-safe-bottom);
        border-start-start-radius: var(--border-radius-24);
        border-start-end-radius: var(--border-radius-24);
        background-color: var(--color-surface-primary);
        box-shadow: var(--shadow-large);
      }
    }

    &:global(.isSideSheet) {
      @media (width >= 900px) {
        --dialog-open-inline-translate: -100%;
        --dialog-closed-inline-translate: 0;
        --dialog-closed-block-translate: 0;

        left: 100dvw;
        inset-block: 0;
        inline-size: min(24rem, 100dvw);
        block-size: 100dvb;
        max-inline-size: none;
        max-block-size: none;
        margin: 0;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable both-edges;
        border-start-start-radius: var(--border-radius-24);
        border-end-start-radius: var(--border-radius-24);
        background-color: var(--color-surface-primary);
        box-shadow: var(--shadow-large);
      }
    }

    &::backdrop {
      background-color: transparent;
      backdrop-filter: blur(0);
      transition:
        background-color var(--transition-duration-normal) var(--transition-easing-standard),
        backdrop-filter var(--transition-duration-normal) var(--transition-easing-standard),
        display var(--transition-duration-normal) var(--transition-easing-standard) allow-discrete;
    }

    &[open] {
      &::backdrop {
        background-color: var(--color-overlay-background);
        backdrop-filter: blur(10px);
      }
    }
  }

  @starting-style {
    .component {
      &[open] {
        &::backdrop {
          background-color: transparent;
          backdrop-filter: blur(0);
        }
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .component,
    .component:global(.isBottomSheet),
    .component:global(.isSideSheet) {
      --dialog-closed-inline-translate: var(--dialog-open-inline-translate);
      --dialog-closed-block-translate: 0;
    }
  }
</style>
