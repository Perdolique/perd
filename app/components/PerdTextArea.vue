<template>
  <div
    :class="$style.root"
    @click.passive="onRootClick"
  >
    <textarea
      ref="textarea"
      v-model="model"
      :class="$style.textarea"
      :autofocus="autofocus"
      :id="id"
      :placeholder="placeholder"
      :required="required"
    />

    <label
      :for="id"
      :class="[$style.label, { withValue: hasValue }]"
    >
      {{ label }}
    </label>
  </div>
</template>

<script lang="ts" setup>
  import type { TextareaHTMLAttributes } from 'vue';

  interface Props {
    readonly label: string;
    readonly autofocus?: TextareaHTMLAttributes['autofocus'];
    readonly placeholder?: TextareaHTMLAttributes['placeholder'];
    readonly required?: TextareaHTMLAttributes['required'];
  }

  defineProps<Props>();

  const model = defineModel<string>({
    required: true
  })

  const id = useId();
  const hasValue = computed(() => model.value !== '');
  const textAreaRef = useTemplateRef('textarea');

  function onRootClick() {
    textAreaRef.value?.focus();
  }
</script>

<style module>
  .root {
    position: relative;
    background-color: var(--input-color-background);
    border: 1px solid var(--input-color-main);
    border-radius: var(--border-radius-16);
    transition: border-color 0.15s ease-out;

    &:has(.textarea:focus-visible) {
      border-color: var(--input-color-focus);
    }
  }

  .label {
    position: absolute;
    top: 12px;
    left: var(--input-spacing-horizontal);
    pointer-events: none;
    color: var(--input-color-main);
    transform-origin: top left;
    user-select: none;
    transition:
      color 0.15s linear,
      scale 0.15s linear,
      translate 0.15s linear;

    &:global(.withValue),
    .textarea:focus-visible + & {
      scale: 0.70;
      translate: 0 -7px;
    }

    .textarea:focus-visible + & {
      color: var(--input-color-focus);
    }
  }

  .textarea {
    position: absolute;
    inset: 0;
    padding: 0 var(--input-spacing-horizontal);
    margin-top: 20px;
    border: none;
    background: none;
    outline: none;
    color: var(--input-color-text);
    resize: none;
  }

  .textarea::placeholder {
    transition: color 0.15s ease-out;
    color: transparent;
    user-select: none;
  }

  .textarea:focus-visible::placeholder {
    color: var(--input-color-placeholder);
  }
</style>
