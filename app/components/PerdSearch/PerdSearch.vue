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

    <CircleSpinner :class="[$style.spinner, { visible: searching }]" />

    <div
      :class="[$style.dropdown, {
        visible: isActive
      }]"
    >
      <template v-if="hasOptions">
        <SearchOption
          v-for="(option, index) in options"
          :key="index"
          @click="handleOptionClick"
        >
          <slot name="option" :option="option">
            <DefaultOption
              :option="option"
              display-field="name"
              @click="emitSelect"
            />
          </slot>
        </SearchOption>
      </template>

      <SearchOption v-else>
        <slot name="empty">
          <EmptyOption>
            {{ emptyOptionText }}
          </EmptyOption>
        </slot>
      </SearchOption>
    </div>
  </div>
</template>

<script lang="ts" setup generic="Option">
  import type { InputHTMLAttributes } from 'vue';
  import { watchDebounced, onClickOutside } from '@vueuse/core';
  import CircleSpinner from '~/components/CircleSpinner.vue';
  import SearchOption from './SearchOption.vue';
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

  const props = withDefaults(defineProps<Props>(), {
    maxItems: 4
  })

  const emit = defineEmits<Emits>()
  const id = useId()
  const rootRef = ref<HTMLDivElement | null>(null)
  const inputRef = ref<HTMLInputElement | null>(null)
  const searchString = ref('')
  const hasValue = computed(() => searchString.value !== '')
  const isActive = ref(false)
  const hasOptions = computed(() => props.options.length > 0)

  const emptyOptionText = computed(() => {
    if (props.searching === true) {
      return 'Searching...'
    }

    return 'No results found'
  })

  const visibleOptionsCount = computed(
    () => Math.max(Math.min(props.options.length, props.maxItems), 1)
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
    debounce: props.debounce
  })

  onClickOutside(rootRef, () => {
    isActive.value = false
  })
</script>

<style module>
  .component {
    --dropdown-animation-time: 0.2s;

    position: relative;
    z-index: 1;
    height: var(--input-height);
    background-color: var(--color-white);
    border: 1px solid var(--input-color-main);
    border-radius: var(--input-border-radius);
    transition:
      border-color 0.15s ease-out,
      border-radius 0.1s ease-out var(--dropdown-animation-time);

    &:has(.input:focus-visible) {
      border-color: var(--input-color-focus);
    }

    &:has(.dropdown:global(.visible)) {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: transparent;
      transition: none;
    }
  }

  .label {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    display: flex;
    align-items: center;
    pointer-events: none;
    color: var(--input-color-main);
    left: var(--input-spacing-horizontal);
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

    .input:focus-visible + & {
      color: var(--input-color-focus);
    }
  }

  .input {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    padding: 12px var(--input-spacing-horizontal) 0;
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
    right: var(--input-spacing-horizontal);
    display: none;
    opacity: 0;
    color: var(--input-secondary-color-text);
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
    box-sizing: content-box;
    top: 100%;
    left: -1px;
    right: -1px;
    background-color: var(--color-white);
    border: 1px solid var(--input-color-main);
    border-top: none;
    border-radius: 0 0 var(--input-border-radius) var(--input-border-radius);
    overflow: hidden auto;
    user-select: none;
    transition:
      display var(--dropdown-animation-time) ease-out allow-discrete,
      height var(--dropdown-animation-time) ease-out;

    &:global(.visible) {
      display: block;
      height: calc(v-bind(visibleOptionsCount) * var(--input-height));
      color: var(--input-color-text);

      @starting-style {
        height: 0;
      }
    }

    .input:focus-visible ~ & {
      border-color: var(--input-color-focus);
    }
  }
</style>
