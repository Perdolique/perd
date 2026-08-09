<template>
  <div :class="$style.component">
    <label :for="inputId" :class="$style.label">
      {{ label }}
    </label>

    <input
      :id="inputId"
      ref="input"
      v-model="value"
      :class="$style.input"
      :disabled="disabled"
      :maxlength="maxlength"
      :name="name"
      :placeholder="placeholder"
      :required="required"
      type="text"
      autocomplete="off"
    >
  </div>
</template>

<script lang="ts" setup>
  import { useId, useTemplateRef } from 'vue'

  interface Props {
    disabled?: boolean;
    label: string;
    maxlength?: number;
    name: string;
    placeholder?: string;
    required?: boolean;
  }

  const {
    disabled,
    label,
    maxlength,
    name,
    placeholder,
    required
  } = defineProps<Props>()

  const value = defineModel<string>({
    required: true
  })

  const inputId = useId()
  const input = useTemplateRef('input')

  function focus() {
    input.value?.focus()
  }

  defineExpose({ focus })
</script>

<style module>
  .component {
    display: grid;
    align-content: start;
    gap: var(--spacing-8);
  }

  .label {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .input {
    inline-size: 100%;
    min-block-size: var(--layout-button-height-medium);
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--layout-button-radius-small);
    background-color: var(--color-background-elevated);
    color: var(--color-text-primary);
    font: inherit;

    &:hover:not(:disabled) {
      border-color: var(--color-accent-primary);
    }

    &:focus-visible {
      border-color: var(--color-accent-primary);
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
      box-shadow: var(--shadow-focus);
    }
  }
</style>
