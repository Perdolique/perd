<template>
  <div :class="$style.root">
    <input
      v-model="model"
      :class="$style.input"
      :autocomplete="autocomplete"
      :autofocus="autofocus"
      :id="id"
      :inputmode="inputmode"
      :pattern="pattern"
      :placeholder="placeholder"
      :required="required"
      :type="type"
    >

    <label
      :for="id"
      :class="[$style.label, { withValue: hasValue }]"
    >
      {{ label }}
    </label>
  </div>
</template>

<script lang="ts" setup>
  import type { InputHTMLAttributes } from 'vue';

  interface Props {
    readonly label: string;
    readonly autocomplete?: InputHTMLAttributes['autocomplete'];
    readonly autofocus?: InputHTMLAttributes['autofocus'];
    readonly inputmode?: InputHTMLAttributes['inputmode'];
    readonly pattern?: InputHTMLAttributes['pattern'];
    readonly placeholder?: InputHTMLAttributes['placeholder'];
    readonly required?: InputHTMLAttributes['required'];
    readonly type?: 'text';
  }

  const {
    type = 'text'
  } = defineProps<Props>();

  const model = defineModel<string>({
    required: true
  })

  const id = useId();
  const hasValue = computed(() => model.value !== '');
</script>

<style module>
  .root {
    position: relative;
    height: var(--input-height);
    background-color: var(--input-color-background);
    border: 1px solid var(--input-color-border);
    border-radius: var(--border-radius-16);
    transition: border-color 0.15s ease-out;

    &:has(.input:focus-visible) {
      border-color: var(--input-color-focus);
    }
  }

  .label {
    position: absolute;
    inset: 0;
    left: var(--input-padding-horizontal);
    display: flex;
    align-items: center;
    pointer-events: none;
    color: var(--input-color-label);
    transform-origin: top left;
    user-select: none;
    transition:
      color 0.15s linear,
      scale 0.15s linear,
      translate 0.15s linear;

    &:global(.withValue),
    .input:focus-visible + & {
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
    padding: 12px var(--input-padding-horizontal) 0;
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
