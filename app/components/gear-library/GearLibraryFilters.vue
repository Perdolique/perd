<template>
  <div :class="$style.component">
    <div :class="$style.controls">
      <slot name="controls" />
    </div>

    <div :class="$style.main">
      <div :class="$style.resultsToolbar">
        <div :class="$style.resultsSummary">
          <slot name="results-summary" />
        </div>

        <div ref="filterAction" :class="$style.filterAction">
          <PerdButton
            :id="filterTriggerId"
            variant="secondary"
            aria-haspopup="dialog"
            :aria-expanded="isDialogOpen"
            @click="emit('open')"
          >
            Filters

            <span v-if="appliedFilterCount > 0" :class="$style.badge">
              {{ appliedFilterCount }}
            </span>
          </PerdButton>
        </div>
      </div>

      <div v-if="appliedFilterChips.length > 0" :class="$style.appliedFilters">
        <ul ref="chipsList" :class="$style.chips" aria-label="Applied filters">
          <li v-for="(chip, chipIndex) in appliedFilterChips" :key="chip.id">
            <button
              :class="$style.chip"
              type="button"
              :aria-label="chip.removeLabel"
              @click="emitRemove(chip, chipIndex)"
            >
              <span>{{ chip.label }}</span>
              <span aria-hidden="true">×</span>
            </button>
          </li>
        </ul>

        <PerdButton size="small" variant="ghost" @click="emitClearApplied">
          Clear all
        </PerdButton>
      </div>

      <div :class="$style.results">
        <slot />
      </div>
    </div>

    <ModalDialog
      v-model="isDialogOpen"
      :class="$style.filterDialog"
      :aria-labelledby="filterTitleId"
      :invoker-id="filterTriggerId"
      desktop-presentation="side-sheet"
      mobile-presentation="bottom-sheet"
    >
      <GearLibraryFilterEditor
        v-model="draftFilters"
        v-model:brand-search-value="brandSearchValue"
        v-model:is-brand-list-expanded="isBrandListExpanded"
        :brands="brands"
        :draft-filter-count="draftFilterCount"
        :has-brands-unavailable="hasBrandsUnavailable"
        :has-draft-changes="hasDraftChanges"
        :has-draft-filters="hasDraftFilters"
        :has-number-range-errors="hasNumberRangeErrors"
        :has-properties-unavailable="hasPropertiesUnavailable"
        :has-selected-category="hasSelectedCategory"
        :is-brands-pending="isBrandsPending"
        :is-properties-pending="isPropertiesPending"
        :number-range-errors="numberRangeErrors"
        :properties="properties"
        :title-id="filterTitleId"
        @apply="emitApply"
        @cancel="emitCancel"
        @clear="emitClearFilters"
        @retry-brands="emit('retry-brands')"
        @retry-properties="emit('retry-properties')"
      />
    </ModalDialog>
  </div>
</template>

<script lang="ts" setup>
  import { nextTick, ref, useId, useTemplateRef, watch } from 'vue'
  import type {
    EquipmentPropertyDataType,
    GearLibraryEntitySummary
  } from '~/types/equipment'
  import type {
    GearLibraryAppliedFilter,
    GearLibraryAppliedFilterChip,
    GearLibraryFilterDraft,
    GearLibraryNumberRangeErrors
  } from '~/utils/gear-library-filters'
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'
  import GearLibraryFilterEditor from '~/components/gear-library/GearLibraryFilterEditor.vue'
  import PerdButton from '~/components/PerdButton.vue'

  interface GearLibraryFilterProperty extends GearLibraryEntitySummary {
    dataType: EquipmentPropertyDataType;
    enumOptions?: GearLibraryEntitySummary[];
    unit: string | null;
  }

  interface Props {
    appliedFilterChips: GearLibraryAppliedFilterChip[];
    appliedFilterCount: number;
    brands: GearLibraryEntitySummary[];
    draftFilterCount: number;
    hasBrandsUnavailable: boolean;
    hasDraftChanges: boolean;
    hasDraftFilters: boolean;
    hasNumberRangeErrors: boolean;
    hasPropertiesUnavailable: boolean;
    hasSelectedCategory: boolean;
    isBrandsPending: boolean;
    isPropertiesPending: boolean;
    numberRangeErrors: GearLibraryNumberRangeErrors;
    properties: GearLibraryFilterProperty[];
  }

  interface Emits {
    (event: 'apply'
      | 'cancel'
      | 'clear-applied'
      | 'open'
      | 'retry-brands'
      | 'retry-properties'): void;
    (event: 'remove', filter: GearLibraryAppliedFilter): void;
  }

  interface RemoveFocusTarget {
    chipId: string;
    index: number;
    type: 'remove';
  }

  interface ClearFocusTarget {
    type: 'clear';
  }

  type PendingFocusTarget = ClearFocusTarget | RemoveFocusTarget

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const draftFilters = defineModel<GearLibraryFilterDraft>('draftFilters', { required: true })
  const isDialogOpen = defineModel<boolean>('isDialogOpen', { required: true })
  const brandSearchValue = ref('')
  const isBrandListExpanded = ref(false)
  const pendingFocusTarget = ref<PendingFocusTarget>()
  const componentId = useId()
  const filterTitleId = `${componentId}-filter-title`
  const filterTriggerId = `${componentId}-filter-trigger`
  const filterAction = useTemplateRef('filterAction')
  const chipsList = useTemplateRef('chipsList')

  function focusFilterTrigger() {
    const filterTrigger = filterAction.value?.querySelector('button')

    filterTrigger?.focus()
  }

  function emitRemove(chip: GearLibraryAppliedFilterChip, index: number) {
    pendingFocusTarget.value = {
      chipId: chip.id,
      index,
      type: 'remove'
    }
    emit('remove', chip)
  }

  function emitClearApplied() {
    pendingFocusTarget.value = { type: 'clear' }
    emit('clear-applied')
  }

  function resetBrandListView() {
    brandSearchValue.value = ''
    isBrandListExpanded.value = false
  }

  watch(isDialogOpen, (isOpen) => {
    if (isOpen === false) {
      resetBrandListView()
    }
  })

  watch(
    () => props.appliedFilterChips.map((chip) => chip.id),
    async (chipIds) => {
      const focusTarget = pendingFocusTarget.value

      if (focusTarget === undefined) {
        return
      }

      const isRemovalPending = focusTarget.type === 'remove'
        && chipIds.includes(focusTarget.chipId)
      const isClearPending = focusTarget.type === 'clear' && chipIds.length > 0

      if (isRemovalPending || isClearPending) {
        return
      }

      pendingFocusTarget.value = undefined

      await nextTick()

      if (focusTarget.type === 'remove' && chipIds.length > 0) {
        const nextChipIndex = Math.min(focusTarget.index, chipIds.length - 1)
        const chipElements = chipsList.value?.querySelectorAll('button')
        const nextChip = chipElements?.[nextChipIndex]

        if (nextChip !== undefined) {
          nextChip.focus()

          return
        }
      }

      focusFilterTrigger()
    }
  )

  function emitApply() {
    resetBrandListView()
    emit('apply')
  }

  function emitCancel() {
    resetBrandListView()
    emit('cancel')
  }

  function emitClearFilters() {
    resetBrandListView()
    emit('clear-applied')
  }
</script>

<style module>
  .component,
  .controls,
  .main,
  .results,
  .resultsSummary {
    min-inline-size: 0;
  }

  .component {
    display: grid;
    gap: var(--spacing-16);
  }

  /* Keep open select options above the sticky results toolbar. */
  .controls:has([aria-expanded='true']) {
    z-index: 4;
  }

  .main {
    display: grid;
    gap: var(--spacing-16);
  }

  .resultsToolbar {
    position: sticky;
    z-index: 3;
    inset-block-start: 0;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--spacing-16);
    padding-block: var(--spacing-8);
    background-color: color-mix(in oklch, var(--color-background-page) 90%, transparent);
    backdrop-filter: blur(12px);
  }

  .filterAction {
    flex: none;
  }

  .badge {
    display: inline-grid;
    place-items: center;
    min-inline-size: 1.5rem;
    min-block-size: 1.5rem;
    padding-inline: var(--spacing-4);
    border-radius: var(--border-radius-pill);
    background-color: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    font-size: var(--font-size-12);
  }

  .appliedFilters {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: var(--spacing-8) var(--spacing-16);
  }

  .chips {
    display: flex;
    flex: 1 1 30rem;
    flex-wrap: wrap;
    gap: var(--spacing-8);
    padding: 0;
    list-style: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-8);
    min-block-size: var(--layout-touch-target);
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-accent-subtle-border);
    border-radius: var(--border-radius-pill);
    background-color: var(--color-accent-subtle);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--font-size-14);

    &:hover {
      background-color: var(--color-accent-subtle-hover);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }
  }

  @media (forced-colors: active) {
    .chip:focus {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }

  .filterDialog {
    @media (width < 900px) {
      block-size: 90dvb;
    }
  }
</style>
