<template>
  <div :class="$style.component">
    <Icon
      name="tabler:chevron-down"
      size="1.5rem"
      :class="$style.arrow"
    />

    <select
      :class="[$style.select, { selected: hasSelectedOption }]"
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
        :selected="isOptionSelected(option.value)"
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
  const hasSelectedOption = computed(() => selectedOption.value !== '');

  function isOptionSelected(value: string) {
    return selectedOption.value === value;
  }
</script>

<style module>
  .component {
    position: relative;
  }

  .arrow {
    position: absolute;
    right: var(--input-padding-horizontal);
    top: 50%;
    translate: 0 -50%;
    pointer-events: none;
    color: var(--input-color-label);
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
    padding: 0 calc(var(--input-padding-horizontal) + 1.5rem) 0 var(--input-padding-horizontal);
    cursor: pointer;
    border-radius: var(--input-border-radius);
    background-color: var(--input-color-background);
    color: var(--input-color-label);
    border: 1px solid var(--input-color-border);
    overflow: hidden;
    text-overflow: ellipsis;
    transition: border-color var(--transition-time-quick);

    &:global(.selected) {
      color: var(--input-color-text);
    }

    &:hover,
    &:focus-visible {
      border-color: var(--input-color-focus);
    }
  }

  .option {
    outline: none;
    background-color: var(--input-color-background);
    color: var(--input-color-text);
    cursor: pointer;
    transition: background-color var(--transition-time-quick);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;

    &:checked {
      background-color: var(--select-color-active);
    }

    &:global(.placeholder) {
      display: none;
    }
  }
</style>
