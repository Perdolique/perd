<template>
  <div
    ref="component"
    :class="$style.component"
    @focusout="handleFocusOut"
  >
    <label :id="labelId" :for="triggerId" :class="$style.label">
      {{ label }}
    </label>

    <button
      :id="triggerId"
      type="button"
      role="combobox"
      :class="$style.button"
      :disabled="isControlDisabled"
      :data-value="modelValue"
      :aria-busy="pending"
      :aria-controls="listboxId"
      :aria-expanded="isOpen"
      :aria-activedescendant="activeOptionId"
      :aria-labelledby="buttonLabelledBy"
      aria-haspopup="listbox"
      @click="toggleDropdown"
      @keydown.arrow-down.prevent="activateNextOption"
      @keydown.arrow-up.prevent="activatePreviousOption"
      @keydown.enter.prevent="handleConfirmKey"
      @keydown.escape="handleEscapeKey"
      @keydown.space.prevent="handleConfirmKey"
      @keydown.tab="handleTabKey"
    >
      <span :id="valueId" :class="$style.selectedValue">
        {{ selectedLabel }}
      </span>

      <span :class="$style.indicator" aria-hidden="true">
        <FidgetSpinner
          v-if="showPendingIndicator"
          :class="$style.spinner"
          data-testid="perd-select-progress"
        />

        <Icon
          v-else
          name="hugeicons:arrow-down-01"
          :class="[$style.chevron, { isOpen }]"
        />
      </span>
    </button>

    <PerdSelectListbox
      v-if="hasOptions"
      :id="listboxId"
      :active-index="activeOptionIndex"
      :hidden="isListboxHidden"
      :options="options"
      @activate="activateOption"
      @select="selectOption"
    />
  </div>
</template>

<script lang="ts">
  export interface PerdSelectOption {
    disabled?: boolean;
    label: string;
    value: string;
  }
</script>

<script lang="ts" setup>
  import { computed, ref, useId, useTemplateRef, watch } from 'vue'
  import { onClickOutside } from '@vueuse/core'
  import { useDelayedPendingIndicator } from '~/composables/use-delayed-pending-indicator'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PerdSelectListbox from './PerdSelectListbox.vue'

  interface Props {
    disabled?: boolean;
    label: string;
    options: PerdSelectOption[];
    pending?: boolean;
  }

  const {
    disabled,
    label,
    options,
    pending
  } = defineProps<Props>()

  const modelValue = defineModel<string>({
    required: true
  })

  const component = useTemplateRef('component')
  const componentId = useId()
  const labelId = `${componentId}-label`
  const listboxId = `${componentId}-listbox`
  const triggerId = `${componentId}-trigger`
  const valueId = `${componentId}-value`
  const isOpen = ref(false)
  const activeOptionIndex = ref(-1)
  const enabledOptionIndexes = computed(() => {
    const indexes: number[] = []

    for (const [index, option] of options.entries()) {
      if (option.disabled !== true) {
        indexes.push(index)
      }
    }

    return indexes
  })
  const hasOptions = computed(() => options.length > 0)
  const hasEnabledOptions = computed(() => enabledOptionIndexes.value.length > 0)
  const isControlDisabled = computed(() => (
    disabled === true || pending === true || hasEnabledOptions.value === false
  ))
  const selectedOption = computed(() => (
    options.find((option) => option.value === modelValue.value)
  ))
  const selectedLabel = computed(() => selectedOption.value?.label ?? '')
  const activeOptionId = computed(() => {
    if (isOpen.value === false || activeOptionIndex.value === -1) {
      return
    }

    return `${listboxId}-option-${activeOptionIndex.value}`
  })
  const buttonLabelledBy = computed(() => `${labelId} ${valueId}`)
  const isListboxHidden = computed(() => isOpen.value === false)
  const showPendingIndicator = useDelayedPendingIndicator(() => pending === true, {
    delayMs: 300,
    minimumVisibleMs: 180
  })

  function isOptionEnabled(index: number) {
    const option = options[index]

    return option !== undefined && option.disabled !== true
  }

  function getInitialOptionIndex(fallbackIndex: number) {
    const selectedIndex = options.findIndex((option) => option.value === modelValue.value)

    return isOptionEnabled(selectedIndex) ? selectedIndex : fallbackIndex
  }

  function activateOption(index: number) {
    if (isOptionEnabled(index)) {
      activeOptionIndex.value = index
    }
  }

  function openDropdown(fallbackIndex: number) {
    if (isControlDisabled.value) {
      return
    }

    isOpen.value = true
    activeOptionIndex.value = getInitialOptionIndex(fallbackIndex)
  }

  function closeDropdown() {
    isOpen.value = false
    activeOptionIndex.value = -1
  }

  function toggleDropdown() {
    if (isOpen.value) {
      closeDropdown()
      return
    }

    const firstOptionIndex = enabledOptionIndexes.value[0] ?? -1

    openDropdown(firstOptionIndex)
  }

  function activateRelativeOption(offset: number) {
    const activePosition = enabledOptionIndexes.value.indexOf(activeOptionIndex.value)
    const fallbackPosition = offset > 0 ? -1 : enabledOptionIndexes.value.length
    const nextPosition = Math.min(
      Math.max((activePosition === -1 ? fallbackPosition : activePosition) + offset, 0),
      enabledOptionIndexes.value.length - 1
    )

    activeOptionIndex.value = enabledOptionIndexes.value[nextPosition] ?? -1
  }

  function activateNextOption() {
    if (isOpen.value === false) {
      const firstOptionIndex = enabledOptionIndexes.value[0] ?? -1

      openDropdown(firstOptionIndex)
      return
    }

    activateRelativeOption(1)
  }

  function activatePreviousOption() {
    if (isOpen.value === false) {
      const lastOptionIndex = enabledOptionIndexes.value.at(-1) ?? -1

      openDropdown(lastOptionIndex)
      return
    }

    activateRelativeOption(-1)
  }

  function selectOption(value: string) {
    const selectedIndex = options.findIndex((option) => option.value === value)

    if (isOptionEnabled(selectedIndex) === false) {
      return
    }

    modelValue.value = value
    closeDropdown()
  }

  function selectActiveOption() {
    const activeOption = options[activeOptionIndex.value]

    if (activeOption !== undefined) {
      selectOption(activeOption.value)
    }
  }

  function handleConfirmKey() {
    if (isOpen.value === false) {
      const firstOptionIndex = enabledOptionIndexes.value[0] ?? -1

      openDropdown(firstOptionIndex)
      return
    }

    selectActiveOption()
  }

  function handleEscapeKey(event: KeyboardEvent) {
    if (isOpen.value === false) {
      return
    }

    event.preventDefault()
    closeDropdown()
  }

  function handleTabKey() {
    if (isOpen.value) {
      selectActiveOption()
    }
  }

  function handleFocusOut(event: FocusEvent) {
    const nextFocusedElement = event.relatedTarget
    const isNextFocusInside = nextFocusedElement instanceof globalThis.Node
      && component.value?.contains(nextFocusedElement) === true

    if (isNextFocusInside === false) {
      closeDropdown()
    }
  }

  onClickOutside(component, closeDropdown)

  watch(() => options, () => {
    if (isOpen.value && isOptionEnabled(activeOptionIndex.value) === false) {
      const firstOptionIndex = enabledOptionIndexes.value[0] ?? -1

      activeOptionIndex.value = getInitialOptionIndex(firstOptionIndex)
    }
  }, { deep: true })

  watch(isControlDisabled, (controlIsDisabled) => {
    if (controlIsDisabled) {
      closeDropdown()
    }
  })
</script>

<style module>
  .component {
    position: relative;
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

  .button {
    appearance: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--layout-touch-target);
    align-items: center;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--layout-button-height-medium);
    padding: 0 0 0 var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--layout-button-radius-small);
    background-color: var(--color-background-elevated);
    color: var(--color-text-primary);
    cursor: pointer;
    line-height: var(--line-height-snug);
    text-align: start;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover:not(:disabled) {
      border-color: var(--color-accent-primary);
    }

    &:focus-visible {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }

    &:disabled {
      border-color: var(--color-border-subtle);
      background-color: var(--color-surface-secondary);
      color: var(--color-text-muted);
      cursor: not-allowed;
    }
  }

  .selectedValue {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .indicator {
    display: grid;
    place-items: center;
    align-self: stretch;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .spinner,
  .chevron {
    font-size: var(--font-size-16);
  }

  .chevron {
    rotate: 0deg;
    transition: rotate var(--transition-duration-fast) var(--transition-easing-standard);

    &:global(.isOpen) {
      rotate: 180deg;
    }
  }

  @media (forced-colors: active) {
    .button:focus {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
