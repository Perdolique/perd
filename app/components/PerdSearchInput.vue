<template>
  <div :class="$style.component">
    <label :for="inputId" :class="$style.label">
      {{ label }}
    </label>

    <div :class="$style.inputShell">
      <input
        :id="inputId"
        ref="input"
        v-model="value"
        :class="$style.input"
        :name="name"
        :placeholder="placeholder"
        type="search"
        autocomplete="off"
        enterkeyhint="search"
        @keydown="emit('keydown', $event)"
      >

      <button
        type="button"
        :class="$style.clearButton"
        :hidden="isClearButtonHidden"
        :aria-label="clearLabel"
        @click="clear"
      >
        <Icon
          name="hugeicons:cancel-01"
          :class="$style.clearIcon"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, nextTick, useId, useTemplateRef } from 'vue'

  interface Props {
    clearLabel?: string;
    label: string;
    name: string;
    placeholder: string;
  }

  interface Emits {
    keydown: [event: KeyboardEvent];
  }

  const {
    clearLabel = 'Clear search',
    label,
    name,
    placeholder
  } = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const value = defineModel<string>({
    required: true
  })

  const inputId = useId()
  const input = useTemplateRef('input')
  const isClearButtonHidden = computed(() => value.value === '')

  async function clear() {
    value.value = ''

    await nextTick()

    input.value?.focus()
  }
</script>

<style module>
  .component {
    display: grid;
    align-content: start;
    gap: var(--spacing-8);
    min-inline-size: 0;
  }

  .label {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .inputShell {
    position: relative;
    min-inline-size: 0;
  }

  .input {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--layout-button-height-medium);
    padding-inline: var(--spacing-12) calc(var(--layout-touch-target) + var(--spacing-8));
    border: 1px solid var(--color-border-strong);
    border-radius: var(--layout-button-radius-small);
    background-color: var(--color-background-elevated);
    color: var(--color-text-primary);
    font: inherit;
    line-height: var(--line-height-snug);
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover {
      border-color: var(--color-accent-primary);
    }

    &:focus-visible {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }

    &::-webkit-search-cancel-button {
      appearance: none;
    }

    @media (forced-colors: active) {
      &:focus {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }
    }
  }

  .clearButton {
    appearance: none;
    position: absolute;
    display: grid;
    place-items: center;
    inset-block-start: 50%;
    inset-inline-end: var(--spacing-4);
    inline-size: var(--layout-touch-target);
    block-size: var(--layout-touch-target);
    padding: 0;
    border: 0;
    border-radius: var(--border-radius-pill);
    background-color: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 1;
    scale: 1;
    translate: 0 -50%;
    transition:
      display var(--transition-duration-fast),
      opacity var(--transition-duration-fast) var(--transition-easing-standard),
      scale var(--transition-duration-fast) var(--transition-easing-standard);
    transition-behavior: allow-discrete;

    &:hover {
      background-color: var(--color-surface-tertiary);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      background-color: var(--color-surface-tertiary);
      color: var(--color-text-primary);
      box-shadow: var(--shadow-focus);
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }

    &[hidden] {
      display: none;
      opacity: 0;
      scale: 0.8;
    }

    @starting-style {
      opacity: 0;
      scale: 0.8;
    }

    @media (forced-colors: active) {
      &:focus {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }
    }
  }

  .clearIcon {
    font-size: var(--font-size-20);
  }

</style>
