<template>
  <div :class="$style.component">
    <label :for="inputId" :class="$style.label">
      {{ label }}
    </label>

    <input
      :id="inputId"
      v-model="value"
      :class="$style.input"
      :disabled="disabled"
      :name="name"
      :aria-describedby="describedBy"
      type="number"
      inputmode="decimal"
      step="any"
    >

    <span v-if="hasUnit" :id="unitId" :class="$style.hint">
      Unit: {{ unit }}
    </span>

    <span
      v-if="hasError"
      :id="errorId"
      :class="$style.errorMessage"
      role="alert"
    >
      {{ error }}
    </span>
  </div>
</template>

<script lang="ts" setup>
  import { computed, useId } from 'vue'

  interface Props {
    disabled?: boolean;
    error?: string;
    label: string;
    name: string;
    unit?: string | null;
  }

  const {
    disabled,
    error,
    label,
    name,
    unit
  } = defineProps<Props>()

  const value = defineModel<string>({
    required: true
  })

  const componentId = useId()
  const inputId = `${componentId}-input`
  const unitId = `${componentId}-unit`
  const errorId = `${componentId}-error`
  const hasUnit = computed(() => unit !== undefined && unit !== null)
  const hasError = computed(() => error !== undefined)

  const describedBy = computed(() => {
    const ids = []

    if (hasUnit.value) {
      ids.push(unitId)
    }

    if (hasError.value) {
      ids.push(errorId)
    }

    return ids.length === 0 ? undefined : ids.join(' ')
  })
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

  .hint {
    color: var(--color-text-muted);
    font-size: var(--font-size-14);
  }

  .errorMessage {
    color: var(--color-danger-primary);
  }
</style>
