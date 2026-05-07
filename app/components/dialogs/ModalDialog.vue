<template>
  <dialog
    ref="dialogRef"
    :class="$style.dialog"
    @cancel="handleCancel"
  >
    <slot />
  </dialog>
</template>

<script lang="ts" setup>
  import { useTemplateRef, watchEffect } from 'vue'
  import { useEventListener } from '@vueuse/core'

  interface Props {
    closeDisabled?: boolean;
  }

  const { closeDisabled = false } = defineProps<Props>()
  const dialogRef = useTemplateRef('dialogRef')

  const isOpened = defineModel<boolean>({
    required: true
  })

  watchEffect(() => {
    if (isOpened.value) {
      dialogRef.value?.showModal()
    } else {
      dialogRef.value?.close()
    }
  })

  useEventListener(dialogRef, 'close', () => {
    isOpened.value = false
  })

  // Close the dialog when clicking outside of it
  useEventListener(dialogRef, 'click', ({ target }: MouseEvent) => {
    if (closeDisabled) {
      return
    }

    if (target === dialogRef.value) {
      dialogRef.value?.close()
    }
  })

  function handleCancel(event: Event) {
    if (closeDisabled) {
      event.preventDefault()
    }
  }
</script>

<style module>
  .dialog {
    padding: 0;
    border: none;
    background: none;

    opacity: 0;
    translate: 0 0.75rem;
    transition:
      opacity var(--transition-duration-base) var(--transition-easing-out),
      translate var(--transition-duration-base) var(--transition-easing-out),
      overlay var(--transition-duration-base) var(--transition-easing-out) allow-discrete,
      display var(--transition-duration-base) var(--transition-easing-out) allow-discrete;

    &[open] {
      opacity: 1;
      translate: 0 0;

      @starting-style {
        opacity: 0;
        translate: 0 0.75rem;
      }
    }
  }

  .dialog::backdrop {
    background-color: transparent;
    backdrop-filter: blur(0);
    transition:
      background-color var(--transition-duration-base) var(--transition-easing-out),
      backdrop-filter var(--transition-duration-base) var(--transition-easing-out),
      display var(--transition-duration-base) var(--transition-easing-out) allow-discrete;
  }

  .dialog[open]::backdrop {
    background-color: var(--color-overlay-background);
    backdrop-filter: blur(10px);
  }

  @starting-style {
    .dialog[open]::backdrop {
      background-color: transparent;
      backdrop-filter: blur(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dialog,
    .dialog[open] {
      translate: 0;
    }
  }
</style>
