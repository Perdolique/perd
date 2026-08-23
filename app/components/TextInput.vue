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
      :aria-describedby="describedBy"
      :aria-invalid="ariaInvalid"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :maxlength="maxlength"
      :name="name"
      :placeholder="placeholder"
      :required="required"
      :type="type"
    >

    <span v-if="hasHint" :id="hintId" :class="$style.hint">
      {{ hint }}
    </span>

    <span
      v-if="hasError"
      :id="errorId"
      :class="$style.error"
      role="alert"
    >
      {{ error }}
    </span>
  </div>
</template>

<script lang="ts" setup>
  import { computed, useId, useTemplateRef } from 'vue'

  interface Props {
    autocomplete?: string;
    disabled?: boolean;
    error?: string;
    hint?: string;
    label: string;
    maxlength?: number;
    name: string;
    placeholder?: string;
    required?: boolean;
    type?: 'text' | 'url';
  }

  const {
    autocomplete = 'off',
    disabled,
    error,
    hint,
    label,
    maxlength,
    name,
    placeholder,
    required,
    type = 'text'
  } = defineProps<Props>()

  const value = defineModel<string>({
    required: true
  })

  const componentId = useId()
  const inputId = `${componentId}-input`
  const hintId = `${componentId}-hint`
  const errorId = `${componentId}-error`
  const input = useTemplateRef('input')
  const hasHint = computed(() => hint !== undefined)
  const hasError = computed(() => error !== undefined)
  const ariaInvalid = computed(() => hasError.value || undefined)

  const describedBy = computed(() => {
    const ids = []

    if (hasHint.value) {
      ids.push(hintId)
    }

    if (hasError.value) {
      ids.push(errorId)
    }

    return ids.length === 0 ? undefined : ids.join(' ')
  })

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

    &[aria-invalid='true'] {
      border-color: var(--color-danger-primary);
    }
  }

  .hint {
    color: var(--color-text-muted);
    font-size: var(--font-size-14);
  }

  .error {
    color: var(--color-danger-primary);
  }
</style>
