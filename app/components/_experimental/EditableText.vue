<template>
  <component
    :is="is"
    ref="componentRef"
    tabindex="0"
    :contenteditable="isEditMode"
    :class="$style.component"
    @dblclick="onDoubleClick"
    @keydown.escape.prevent="disableEditMode"
    @keydown.enter.prevent="onEnterDown"
    @blur.capture="onBlur"
    @touchstart.passive.stop="onTouchStart"
  >
    {{ model }}
  </component>
</template>

<script lang="ts" setup>
  interface Props {
    readonly is?: string | Component;
  }

  const { is = 'span' } = defineProps<Props>();

  const model = defineModel<string>({
    required: true,
  });

  let lastTap = 0;
  const componentRef = useTemplateRef('componentRef');
  const isEditMode = ref(false);

  function enableEditMode() {
    if (componentRef.value instanceof HTMLElement) {
      isEditMode.value = true;
    }
  }

  function disableEditMode() {
    isEditMode.value = false;
  }

  function setCaretToEnd(element: HTMLElement) {
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(element);
    range.collapse();

    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function activateEditMode() {
    if (isEditMode.value === false && componentRef.value instanceof HTMLElement) {
      enableEditMode();
    }
  }

  function onDoubleClick() {
    if (isEditMode.value) {
      return;
    }

    activateEditMode();

    if (componentRef.value instanceof HTMLElement) {
      setCaretToEnd(componentRef.value);
    }
  }

  function onEnterDown() {
    if (componentRef.value instanceof HTMLElement) {
      if (isEditMode.value) {
        componentRef.value.blur();
      } else {
        activateEditMode();

        setCaretToEnd(componentRef.value);
      }
    }
  }

  function onTouchStart() {
    if (isEditMode.value === false) {
      const now = new Date().getTime();
      const timeSince = now - lastTap;

      if (timeSince < 300 && timeSince > 0) {
        activateEditMode();
      }

      lastTap = new Date().getTime();
    }
  }

  function onBlur() {
    if (isEditMode.value) {
      if (componentRef.value instanceof HTMLElement) {
        const rawTextContent = componentRef.value.textContent ?? '';
        const processedText = rawTextContent.trim();

        if (processedText !== model.value) {
          model.value = processedText;
        }

        disableEditMode();
      }
    }
  }

  watch(model, (newValue) => {
    if (componentRef.value instanceof HTMLElement) {
      componentRef.value.textContent = newValue;
    }
  });
</script>

<style module>
  .component {
    transition: background-color var(--transition-time-quick);
    border-radius: var(--border-radius-4);
    cursor: pointer;
    outline: 2px solid transparent;
    outline-offset: 2px;

    &[contenteditable="true"] {
      background-color: var(--background-50);
      cursor: text;
    }

    &:focus-visible,
    &[contenteditable="true"] {
      outline: 2px solid var(--accent-300);
    }

    &:hover:not([contenteditable="true"]) {
      background-color: var(--background-50);
    }
  }
</style>
