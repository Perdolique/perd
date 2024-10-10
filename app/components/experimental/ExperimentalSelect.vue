<template>
  <select
    :class="$style.component"
    v-model="selectedOption"
  >
    <button :class="$style.button">
      <selectedoption />

      <Icon
        name="tabler:chevron-down"
        size="1.5rem"
        :class="$style.icon"
      />
    </button>

    <option
      disabled
      value=""
      class="placeholder"
      :class="$style.option"
    >
      {{ placeholder }}
    </option>

    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :selected="isSelected(option.value)"
      :class="$style.option"
    >
      {{ option.label }}
    </option>
  </select>
</template>

<script lang="ts" setup>
  interface Option {
    readonly value: string;
    readonly label: string;
  }

  interface Props {
    readonly placeholder: string;
    readonly options: readonly Option[];
  }

  defineProps<Props>();

  const selectedOption = defineModel<string>();

  function isSelected(value: string) {
    return selectedOption.value === value;
  }
</script>

<style module>
  .component {
    appearance: base-select;
    width: 100%;
  }

  .button {
    outline: none;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    text-align: left;
    width: 100%;
    height: var(--input-height);
    padding: 0 var(--input-spacing-horizontal);
    border-radius: var(--input-border-radius);
    cursor: pointer;
    background-color: var(--input-secondary-color-main);
    color: var(--input-secondary-color-text);
    border: 1px solid var(--input-secondary-color-border);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    transition: background-color var(--transition-time-quick);

    &:hover {
      background-color: var(--input-secondary-color-focus);
    }

    &:focus-visible {
      background-color: var(--input-secondary-color-focus);
    }

    .component:open & {
      background-color: var(--input-secondary-color-active);
    }
  }

  .icon {
    transition: rotate var(--transition-time-quick);

    .component:open & {
      rotate: x 180deg;
    }
  }

  .component::picker(select) {
    appearance: base-select;
    opacity: 0;
    padding: 0;
    top: 5px;
    max-width: 400px;
    background-color: var(--color-background);
    border: 1px solid var(--color-blue-400);;
    border-radius: var(--border-radius-12);
    box-shadow: var(--shadow-2);
    transition: opacity var(--transition-time-quick);
  }

  .component::picker(select):popover-open {
    opacity: 1;
  }

  @starting-style {
    .component::picker(select):popover-open {
      opacity: 0;
    }
  }

  .option {
    outline: none;
    height: 40px;
    padding: 0 var(--spacing-32) 0 var(--spacing-12);
    background-color: var(--color-background);
    color: var(--color-blue-600);
    cursor: pointer;
    transition: background-color var(--transition-time-quick) ease-out;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover,
    &:focus-visible {
      background-color: var(--color-blue-100);
    }

    &:checked {
      background-color: var(--color-blue-200);
    }

    &:global(.placeholder) {
      display: none;
    }

    &::before {
      display: none;
    }
  }
</style>
