<template>
  <dialog
    ref="dialogRef"
    :class="[$style.component, { isBottomSheet }]"
    @cancel="handleCancel"
  >
    <slot />
  </dialog>
</template>

<script lang="ts" setup>
  import { computed, useTemplateRef, watchEffect } from 'vue'
  import { useEventListener } from '@vueuse/core'

  interface Props {
    closeDisabled?: boolean;
    mobilePresentation?: 'bottom-sheet' | 'centered';
  }

  const {
    closeDisabled,
    mobilePresentation = 'centered'
  } = defineProps<Props>()

  const dialogRef = useTemplateRef('dialogRef')
  let invokingElement: HTMLElement | null = null

  const isOpened = defineModel<boolean>({
    required: true
  })

  const isBottomSheet = computed(() => mobilePresentation === 'bottom-sheet')

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

  useEventListener(dialogRef, 'click', (event: MouseEvent) => {
    const dialog = dialogRef.value

    if (dialog === null || event.target !== dialog) {
      return
    }

    // Safari lacks closedby="any", and ::backdrop is not a DOM event target.
    // Backdrop clicks must therefore be distinguished using the dialog bounds.
    const bounds = dialog.getBoundingClientRect()
    const isWithinInlineBounds = event.clientX >= bounds.left && event.clientX <= bounds.right
    const isWithinBlockBounds = event.clientY >= bounds.top && event.clientY <= bounds.bottom

    if (isWithinInlineBounds && isWithinBlockBounds) {
      return
    }

    dialog.requestClose()
  })

  function handleCancel(event: Event) {
    if (closeDisabled) {
      event.preventDefault()
    }
  }
</script>

<style module>
  .component {
    --dialog-closed-translate: 0.75rem;

    padding: 0;
    border: none;
    background: none;

    opacity: 0;
    translate: 0 var(--dialog-closed-translate);
    transition:
      opacity var(--transition-duration-normal) var(--transition-easing-standard),
      translate var(--transition-duration-normal) var(--transition-easing-standard),
      overlay var(--transition-duration-normal) var(--transition-easing-standard) allow-discrete,
      display var(--transition-duration-normal) var(--transition-easing-standard) allow-discrete;

    &[open] {
      opacity: 1;
      translate: 0 0;

      @starting-style {
        opacity: 0;
        translate: 0 var(--dialog-closed-translate);
      }
    }

    &:global(.isBottomSheet) {
      @media (width < 900px) {
        --dialog-closed-translate: 100%;

        position: fixed;
        inset-block: auto 0;
        inset-inline: 0;
        inline-size: 100%;
        max-inline-size: none;
        max-block-size: 90dvb;
        margin: 0;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
        padding-block-end: var(--layout-safe-bottom);
        border-start-start-radius: var(--border-radius-24);
        border-start-end-radius: var(--border-radius-24);
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
    .component {
      --dialog-closed-translate: 0;

      &:global(.isBottomSheet) {
        --dialog-closed-translate: 0;
      }
    }
  }
</style>
