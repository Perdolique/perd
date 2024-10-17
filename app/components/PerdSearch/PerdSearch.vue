<template>
  <div
    ref="rootRef"
    :class="$style.component"
  >
    <input
      ref="inputRef"
      type="text"
      autocomplete="off"
      inputmode="search"
      v-model.trim="searchString"
      :class="$style.input"
      :autofocus="autofocus"
      :id="id"
      :placeholder="placeholder"
      @focus="handleInputFocus"
    >

    <label
      :for="id"
      :class="[$style.label, { withValue: hasValue }]"
    >
      {{ label }}
    </label>

    <FidgetSpinner
      :class="[$style.spinner, {
        visible: searching
      }]"
      size="1.5em"
    />

    <div
      :class="[$style.dropdown, {
        visible: isActive
      }]"
    >
      <template v-if="hasOptions">
        <div
          v-for="(option, index) in options"
          :key="index"
          :class="[$style.option, 'active']"
          @click="handleOptionClick(option)"
        >
          <slot name="option" :option="option">
            <DefaultOption
              :option="option"
              display-field="name"
              @click="emitSelect"
            />
          </slot>
        </div>
      </template>

      <div
        v-else
        :class="$style.option"
      >
        <slot name="empty">
          <EmptyOption>
            {{ emptyOptionText }}
          </EmptyOption>
        </slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup generic="Option">
  import type { InputHTMLAttributes } from 'vue';
  import { watchDebounced, onClickOutside } from '@vueuse/core';
  import FidgetSpinner from '~/components/FidgetSpinner.vue';
  import EmptyOption from './EmptyOption.vue';
  import DefaultOption from './DefaultOption.vue';

  interface Props {
    readonly label: string;
    readonly options: Option[];
    readonly autofocus?: InputHTMLAttributes['autofocus'];
    readonly placeholder?: InputHTMLAttributes['placeholder'];
    readonly searching?: boolean;
    readonly debounce?: number;
    readonly maxItems?: number;
  }

  interface Emits {
    (event: 'search', searchString: string): void;
    (event: 'select', option: Option): void;
  }

  const {
    options,
    searching,
    debounce,
    maxItems = 4
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()
  const id = useId()
  const rootRef = useTemplateRef('rootRef')
  const inputRef = useTemplateRef('inputRef')
  const searchString = ref('')
  const hasValue = computed(() => searchString.value !== '')
  const isActive = ref(false)
  const hasOptions = computed(() => options.length > 0)

  const emptyOptionText = computed(() => {
    if (searching === true) {
      return 'Searching...'
    }

    return 'No results found'
  })

  const visibleOptionsCount = computed(
    () => Math.max(Math.min(options.length, maxItems), 1)
  )

  function emitSelect(option: Option) {
    emit('select', option)
  }

  function handleOptionClick(option: Option) {
    inputRef.value?.focus()
  }

  function handleInputFocus() {
    if (searchString.value !== '') {
      isActive.value = true
    }
  }

  watch(searchString, () => {
    isActive.value = true
  })

  watchDebounced(searchString, () => {
    emit('search', searchString.value)
  }, {
    debounce: debounce
  })

  onClickOutside(rootRef, () => {
    isActive.value = false
  })
</script>

<style module>
  .component {
    position: relative;
    min-width: 160px;
    height: var(--input-height);
    background-color: var(--input-color-background);
    border: 1px solid var(--input-color-border);
    border-radius: var(--input-border-radius);
    transition:
      border-color 0.15s ease-out,
      border-radius 0.1s ease-out var(--transition-time-quick);

    &:has(.input:focus-visible) {
      border-color: var(--input-color-focus);
    }

    &:has(.dropdown:global(.visible)) {
      border-color: var(--input-color-focus);
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: transparent;
      transition: none;
    }
  }

  .label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    pointer-events: none;
    color: var(--input-color-label);
    left: var(--input-padding-horizontal);
    transform-origin: top left;
    user-select: none;
    transition:
      color 0.15s linear,
      scale 0.15s linear,
      translate 0.15s linear;

    &:global(.withValue),
    .input:focus-visible + & {
      scale: 0.70;
      translate: 0 -5px;
    }
  }

  .input {
    position: absolute;
    inset: 0;
    top: 14px;
    width: 100%;
    padding: 0 var(--input-padding-horizontal);
    border: none;
    background: none;
    color: var(--input-color-text);
    outline: none;
  }

  .input::placeholder {
    transition: color 0.15s ease-out;
    color: transparent;
    user-select: none;
  }

  .input:focus-visible::placeholder {
    color: var(--input-color-placeholder);
  }

  .spinner {
    position: absolute;
    top: 50%;
    right: var(--input-padding-horizontal);
    display: none;
    opacity: 0;
    color: var(--input-color-label);
    translate: 0 -50%;
    transition:
      color 0.15s ease-out,
      display 0.15s ease-out allow-discrete,
      opacity 0.15s ease-out;

    .input:focus-visible ~ & {
      color: var(--input-color-focus);
    }

    &:global(.visible) {
      display: block;
      opacity: 1;

      @starting-style {
        opacity: 0;
      }
    }
  }

  .dropdown {
    display: none;
    height: 0;
    position: absolute;
    z-index: 1;
    box-sizing: content-box;
    top: 100%;
    left: -1px;
    right: -1px;
    background-color: var(--input-color-background);
    border: 1px solid var(--input-color-focus);
    border-top: none;
    border-radius: 0 0 var(--input-border-radius) var(--input-border-radius);
    scrollbar-width: none;
    overflow: hidden auto;
    user-select: none;
    transition:
      display var(--transition-time-quick) ease-out allow-discrete,
      height var(--transition-time-quick) ease-out;

    &:global(.visible) {
      display: block;
      height: calc(v-bind(visibleOptionsCount) * var(--dropdown-option-height));
      color: var(--text-700);

      @starting-style {
        height: 0;
      }
    }

    .input:focus-visible ~ & {
      border-color: var(--input-color-focus);
    }
  }

  .option {
    height: var(--dropdown-option-height);

    &:global(.active) {
      background-color: var(--input-color-background);
      cursor: pointer;
      transition: background-color 0.15s ease-out;

      &:hover {
        background-color: var(--select-color-hover);
      }
    }
  }
</style>
