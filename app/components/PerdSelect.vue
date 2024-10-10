<template>
  <div :class="$style.component">
    <Icon
      name="tabler:chevron-down"
      size="1.5rem"
      :class="$style.arrow"
    />

    <select
      :class="$style.select"
      v-model="selectedOption"
      :required="required"
    >
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
  </div>
</template>

<script lang="ts" setup>
  interface Option {
    readonly value: string;
    readonly label: string;
  }

  interface Props {
    readonly placeholder: string;
    readonly options: readonly Option[];
    readonly required: HTMLSelectElement['required'];
  }

  defineProps<Props>();

  const selectedOption = defineModel<string>();

  function isSelected(value: string) {
    return selectedOption.value === value;
  }
</script>

<style module>
  .component {
    position: relative;
  }

  .arrow {
    position: absolute;
    right: var(--input-spacing-horizontal);
    top: 50%;
    translate: 0 -50%;
    pointer-events: none;
    color: var(--input-secondary-color-text);
    transition: rotate var(--transition-time-quick);

    /* FIXME: experimental and shouldn't be in production */
    .component:has(.select:open) & {
      rotate: x 180deg;
    }
  }

  .select {
    appearance: none;
    width: 100%;
    outline: none;
    height: var(--input-height);
    padding: 0 calc(var(--input-spacing-horizontal) + 1.5rem) 0 var(--input-spacing-horizontal);
    cursor: pointer;
    border-radius: var(--input-border-radius);
    background-color: var(--input-secondary-color-main);
    color: var(--input-secondary-color-text);
    border: 1px solid var(--input-secondary-color-border);
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background-color var(--transition-time-quick);

    &:hover,
    &:focus-visible {
      background-color: var(--input-secondary-color-focus);
    }

    /* FIXME: experimental and shouldn't be in production */
    &:open {
      background-color: var(--input-secondary-color-active);
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
    max-width: 100px;
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
  }
</style>
