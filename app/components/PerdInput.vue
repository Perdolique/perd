<template>
  <div :class="$style.root">
    <label
      :for="id"
      :class="[$style.label, {
        focused: isFocused,
        withValue: hasValue
      }]"
    >
      {{ label }}
    </label>

    <input
      v-model="model"
      :class="$style.input"
      :id="id"
      :inputmode="inputmode"
      :pattern="pattern"
      :placeholder="placeholder"
      :required="required"
      :type="type"
      @focus="handleFocus"
      @blur="handleBlur"
    >
  </div>
</template>

<script lang="ts" setup>
  import type { InputHTMLAttributes } from 'vue';

  interface Props {
    readonly label: string;
    readonly inputmode?: InputHTMLAttributes['inputmode'];
    readonly pattern?: InputHTMLAttributes['pattern'];
    readonly placeholder?: InputHTMLAttributes['placeholder'];
    readonly required?: InputHTMLAttributes['required'];
    readonly type?: 'text';
  }

  withDefaults(defineProps<Props>(), {
    type: 'text'
  });

  const model = defineModel<string>({
    required: true
  })

  const id = useId();
  const isFocused = ref(false);
  const hasValue = computed(() => model.value !== '');

  function handleFocus() : void {
    isFocused.value = true;
  }

  function handleBlur() : void {
    isFocused.value = false;
  }
</script>

<style module>
  .root {
    position: relative;
    height: var(--input-height);
    background-color: var(--color-white);
    border: 1px solid var(--input-color-main);
    border-radius: var(--border-radius-2);
    outline: 1px solid transparent;
    transition:
      outline-color 0.15s ease-out,
      border-color 0.15s ease-out;

    &:has(.input:focus-visible) {
      outline-color: var(--input-color-focus);
      border-color: var(--input-color-focus);
    }
  }

  .label {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    display: flex;
    align-items: center;
    pointer-events: none;
    color: var(--input-color-main);
    left: var(--input-spacing-horizontal);
    transform-origin: top left;
    user-select: none;
    transition:
      scale 0.15s linear,
      translate 0.15s linear;

    &:global(.withValue),
    &:global(.focused) {
      scale: 0.70;
      translate: 0 -5px;
    }
  }

  .input {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    padding: 12px var(--input-spacing-horizontal) 0;
    border: none;
    background: none;
    outline: none;
    color: var(--input-color-text);
  }

  .input::placeholder {
    transition: color 0.15s ease-out;
    color: transparent;
    user-select: none;
  }

  .input:focus-visible::placeholder {
    color: var(--input-color-placeholder);
  }
</style>
