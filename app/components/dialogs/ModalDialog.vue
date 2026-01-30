<template>
  <dialog
    ref="dialogRef"
    :class="$style.dialog"
  >
    <slot />
  </dialog>
</template>

<script lang="ts" setup>
  import { useEventListener } from '@vueuse/core';

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
  });

  useEventListener(dialogRef, 'close', () => {
    isOpened.value = false
  })

  // Close the dialog when clicking outside of it
  useEventListener(dialogRef, 'click', ({ target }) => {
    if (target === dialogRef.value) {
      dialogRef.value?.close()
    }
  })
</script>

<style module>
  .dialog {
    --transition-duration: 0.3s;

    /* Apply transitions */
    opacity: 0;
    translate: 0 -20px;
    transition:
      opacity var(--transition-duration) ease,
      translate var(--transition-duration) ease,
      overlay var(--transition-duration) ease allow-discrete,
      display var(--transition-duration) ease allow-discrete;

    &[open] {
      opacity: 1;
      translate: 0 0;

      @starting-style {
        opacity: 0;
        translate: 0 -20px;
      }
    }
  }

  .dialog::backdrop {
    background-color: transparent;
    backdrop-filter: blur(0);
    transition:
      background-color var(--transition-duration) ease,
      backdrop-filter var(--transition-duration) ease,
      display var(--transition-duration) ease allow-discrete;
  }

  .dialog[open]::backdrop {
    background-color: var(--overlay-color-background);
    backdrop-filter: var(--overlay-backdrop-filter);
  }

  @starting-style {
    .dialog[open]::backdrop {
      background-color: transparent;
      backdrop-filter: blur(0);
    }
  }
</style>
