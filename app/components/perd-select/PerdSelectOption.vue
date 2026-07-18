<template>
  <li
    :id="id"
    role="option"
    :class="[
      $style.component,
      {
        isActive: active,
        isDisabled: disabled
      }
    ]"
    :data-value="value"
    :aria-disabled="disabled"
    :aria-selected="selected"
    @click="selectOption"
    @mousedown.prevent
    @pointerenter="activateOption"
  >
    {{ label }}
  </li>
</template>

<script lang="ts" setup>
  interface Props {
    active: boolean;
    disabled: boolean;
    id: string;
    index: number;
    label: string;
    selected: boolean;
    value: string;
  }

  interface Emits {
    activate: [index: number];
    select: [value: string];
  }

  const {
    active,
    disabled,
    id,
    index,
    label,
    selected,
    value
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()

  function activateOption() {
    if (disabled === false) {
      emit('activate', index)
    }
  }

  function selectOption() {
    if (disabled === false) {
      emit('select', value)
    }
  }
</script>

<style module>
  .component {
    display: flex;
    align-items: center;
    min-block-size: var(--layout-touch-target);
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-6);
    cursor: pointer;

    &:hover:not(:global(.isDisabled)),
    &:global(.isActive) {
      background-color: var(--color-accent-subtle-hover);
    }

    &:global(.isDisabled) {
      color: var(--color-text-muted);
      cursor: not-allowed;
    }
  }

  @media (forced-colors: active) {
    .component:global(.isActive) {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }

    .component:global(.isDisabled) {
      color: GrayText;
    }
  }
</style>
