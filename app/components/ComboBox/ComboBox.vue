<template>
  <div
    ref="rootRef"
    :class="$style.component"
  >
    <PerdInput
      :required="required"
      :model-value="inputValue"
      :label="label"
      :placeholder="placeholder"
      autocomplete="off"
      @update:model-value="onUpdateInput"
    />

    <div :class="[$style.options, { opened: isOpen }]">
      <div
        v-if="isLoading"
        :class="[$style.option, 'loading']"
      >
        Loading...

        <FidgetSpinner />
      </div>

      <div v-else-if="isEmpty" :class="[$style.option, 'empty']">
        No results found
      </div>

      <template v-else>
        <div
          :class="$style.option"
          v-for="option in filteredOptions"
          :key="option.value"
          @click="onOptionClick(option)"
        >
          {{ option.label }}
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { onClickOutside } from '@vueuse/core';
  import PerdInput from '~/components/PerdInput.vue';
  import FidgetSpinner from '../FidgetSpinner.vue';

  interface Option {
    readonly label: string;
    readonly value: string;
  }

  interface Props {
    readonly label: string;
    readonly options: Option[];
    readonly ignoreFilter?: boolean;
    readonly loading?: boolean;
    readonly maxItems?: number;
    readonly placeholder?: string;
    readonly required?: boolean;
  }

  interface Emits {
    search: [query: string];
  }

  const {
    ignoreFilter,
    label,
    loading,
    maxItems = 4,
    options,
    placeholder
  } = defineProps<Props>();

  const emit = defineEmits<Emits>();

  const selected = defineModel<Option | null>('selected', {
    required: true
  });

  const rootRef = useTemplateRef('rootRef');
  const inputValue = ref(selected.value?.label ?? '');
  const isOpen = ref(false);
  const isLoading = computed(() => ignoreFilter ? loading : false);

  const filteredOptions = computed(() => {
    if (ignoreFilter) {
      return options
    };

    return options.filter(option =>
      option.label.toLowerCase().includes(inputValue.value.toLowerCase())
    );
  });

  const selectedLabel = computed(() => {
    return selected.value?.label ?? '';
  });

  const isEmpty = computed(
    () => filteredOptions.value.length === 0
  );

  const visibleOptionsCount = computed(() => {
    if (isLoading.value || isEmpty.value) {
      return 1;
    }

    return Math.max(Math.min(filteredOptions.value.length, maxItems), 1)
  })

  function onOptionClick(option: Option) {
    selected.value = option;
    inputValue.value = option.label;
    isOpen.value = false;
  }

  function onUpdateInput(value: string) {
    inputValue.value = value;
    isOpen.value = true;

    if (ignoreFilter) {
      emit('search', value);
    }
  }

  onClickOutside(rootRef, () => {
    inputValue.value = selectedLabel.value;
    isOpen.value = false
  })

  watch(selected, () => {
    if (selected.value === null) {
      inputValue.value = '';
    }
  })
</script>

<style module>
  .component {
    position: relative;
  }

  @starting-style {
    .options {
      opacity: 0;
    }
  }

  .options {
    --spacing-top: 4px;

    display: none;
    opacity: 0;
    translate: 0 calc(var(--spacing-top) * -1);
    position: absolute;
    top: calc(100% + var(--spacing-top));
    left: 0;
    right: 0;
    z-index: 1;
    height: calc(v-bind(visibleOptionsCount) * var(--dropdown-option-height));
    box-sizing: content-box;
    overflow: hidden auto;
    background-color: var(--input-color-background);
    border: 1px solid var(--input-color-focus);
    border-radius: var(--input-border-radius);
    transition:
      height var(--transition-time-medium),
      translate var(--transition-time-medium),
      opacity var(--transition-time-medium),
      display var(--transition-time-medium) allow-discrete;

    &:global(.opened) {
      translate: 0;
      display: block;
      opacity: 1;

      @starting-style {
        translate: 0 calc(var(--spacing-top) * -1);
        opacity: 0;
      }
    }
  }

  .option {
    align-content: center;
    height: var(--dropdown-option-height);
    padding: var(--dropdown-option-padding);
    color: var(--text-700);
    cursor: pointer;
    transition: background-color 0.15s ease-out;

    &:hover {
      background-color: var(--select-color-hover);
    }

    &:global(.loading),
    &:global(.empty) {
      color: var(--dropdown-option-color-placeholder);
      cursor: default;

      &:hover {
        background-color: transparent;
      }
    }

    &:global(.loading) {
      display: grid;
      grid-auto-flow: column;
      justify-content: space-between;
    }
  }
</style>
