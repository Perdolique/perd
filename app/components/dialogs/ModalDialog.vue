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

  useEventListener(dialogRef, 'close', (event) => {
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
    scale: 1.1;
    transition:
      opacity var(--transition-duration) ease,
      scale var(--transition-duration) ease,
      overlay var(--transition-duration) ease allow-discrete,
      display var(--transition-duration) ease allow-discrete;

    &[open] {
      will-change: scale;
      opacity: 1;
      scale: 1;

      @starting-style {
        opacity: 0;
        scale: 1.1;
      }
    }
  }

  .dialog::backdrop {
    background-color: rgba(0 0 0 / 0%);
    backdrop-filter: blur(0);
    transition:
      background-color var(--transition-duration) ease,
      backdrop-filter var(--transition-duration) ease,
      display var(--transition-duration) ease allow-discrete;
  }

  .dialog[open]::backdrop {
    background-color: rgba(0 0 0 / 50%);
    backdrop-filter: blur(3px);
  }

  @starting-style {
    .dialog[open]::backdrop {
      background-color: rgba(0 0 0 / 0);
      backdrop-filter: blur(0);
    }
  }
</style>
