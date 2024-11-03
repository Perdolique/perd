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
      :disabled="disabled"
    >

    <label
      :for="id"
      :class="[$style.label, { withValue: hasValue }]"
    >
      {{ label }}
    </label>

    <button
      :class="[$style.clearAction, { visible: hasValue }]"
      @click="clearValue"
      type="button"
    >
      <Icon name="tabler:x" />
    </button>
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
    readonly disabled?: InputHTMLAttributes['disabled'];
  }

  type Emits = (event: 'clear') => void;

  const {
    type = 'text'
  } = defineProps<Props>();

  const model = defineModel<string>({
    required: true
  })

  const emit = defineEmits<Emits>();
  const id = useId();
  const hasValue = computed(() => model.value !== '');

  function clearValue() {
    model.value = '';

    emit('clear');
  }
</script>

<style module>
  .root {
    position: relative;
    height: var(--input-height);
    background-color: var(--input-color-background);
    border: 1px solid var(--input-color-border);
    border-radius: var(--border-radius-16);
    transition: border-color var(--transition-time-quick);

    &:has(.input:hover:not(:disabled)),
    &:has(.input:focus-visible) {
      border-color: var(--input-color-focus);
    }

    &:has(.input:disabled) {
      opacity: var(--input-opacity-disabled);
    }
  }

  .input {
    position: absolute;
    inset: 0;
    padding: var(--input-padding-top) var(--input-padding-horizontal) 0;
    border: none;
    background: none;
    outline: none;
    color: var(--input-color-text);
    transition: var(--transition-time-quick);

    &:disabled {
      cursor: not-allowed;
    }
  }

  .input::placeholder {
    color: transparent;
    user-select: none;
    transition: color var(--transition-time-quick);
  }

  .input:focus-visible::placeholder {
    color: var(--input-color-placeholder);
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
      color var(--transition-time-quick) linear,
      scale var(--transition-time-quick) linear,
      translate var(--transition-time-quick) linear;

    &:global(.withValue),
    .input:focus-visible + & {
      scale: 0.70;
      translate: 0 -5px;
    }
  }

  .clearAction {
    /* Reset button styles */
    appearance: none;
    background: none;
    outline: none;

    /* Rest of the styles */
    display: none;
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    aspect-ratio: 1;
    line-height: 1;
    align-content: center;
    cursor: pointer;
    color: var(--input-color-text);
    font-size: var(--font-size-20);
    opacity: 0;
    border-radius: var(--input-border-radius);
    transition:
      background-color var(--transition-time-quick),
      opacity var(--transition-time-quick),
      display var(--transition-time-quick) allow-discrete;

    &:global(.visible) {
      display: block;
      opacity: 1;

      @starting-style {
        opacity: 0;
      }
    }

    &:focus-visible,
    &:hover {
      background-color: color-mix(in oklch, var(--input-color-focus), transparent 70%)
    }
  }
</style>
