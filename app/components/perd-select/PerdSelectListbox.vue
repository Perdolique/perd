<template>
  <ul
    :id="id"
    ref="listbox"
    role="listbox"
    :class="$style.component"
    :hidden="hidden"
  >
    <PerdSelectOption
      v-for="option in renderedOptions"
      :id="option.id"
      :key="option.value"
      :active="option.isActive"
      :disabled="option.isDisabled"
      :index="option.index"
      :label="option.label"
      :visually-selected="option.isVisuallySelected"
      :value="option.value"
      @activate="activateOption"
      @select="selectOption"
    />
  </ul>
</template>

<script lang="ts" setup>
  import { computed, nextTick, useTemplateRef, watch } from 'vue'
  import type { PerdSelectOption as SelectOption } from './PerdSelect.vue'
  import PerdSelectOption from './PerdSelectOption.vue'

  interface Props {
    activeIndex: number;
    hidden: boolean;
    id: string;
    options: SelectOption[];
  }

  interface Emits {
    activate: [index: number];
    select: [value: string];
  }

  interface RenderedSelectOption extends SelectOption {
    id: string;
    index: number;
    isActive: boolean;
    isDisabled: boolean;
    isVisuallySelected: boolean;
  }

  const {
    activeIndex,
    hidden,
    id,
    options
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()
  const listbox = useTemplateRef('listbox')

  const renderedOptions = computed<RenderedSelectOption[]>(() => (
    options.map((option, index) => {
      return {
        disabled: option.disabled,
        id: `${id}-option-${index}`,
        index,
        isActive: index === activeIndex,
        isDisabled: option.disabled === true,
        isVisuallySelected: index === activeIndex,
        label: option.label,
        value: option.value
      }
    })
  ))

  function activateOption(index: number) {
    emit('activate', index)
  }

  function selectOption(value: string) {
    emit('select', value)
  }

  async function scrollActiveOptionIntoView() {
    await nextTick()

    const activeOption = listbox.value?.children.item(activeIndex)

    if (activeOption instanceof globalThis.HTMLElement) {
      activeOption.scrollIntoView({ block: 'nearest' })
    }
  }

  function scheduleActiveOptionScroll() {
    void scrollActiveOptionIntoView()
  }

  watch(() => activeIndex, () => {
    const hasActiveOption = activeIndex >= 0 && activeIndex < options.length

    if (hasActiveOption) {
      scheduleActiveOptionScroll()
    }
  })
</script>

<style module>
  .component {
    position: absolute;
    z-index: 2;
    inset-block-start: calc(100% + var(--spacing-4));
    inset-inline: 0;
    max-block-size: 20rem;
    overflow: hidden auto;
    padding: var(--spacing-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background-color: var(--color-background-elevated);
    box-shadow: var(--shadow-medium);
    color: var(--color-text-primary);
    list-style: none;
    overscroll-behavior: contain;

    &[hidden] {
      display: none;
    }
  }
</style>
