import { computed, nextTick, type Ref } from 'vue'

interface ContributionFeedbackOptions {
  filtersPanel: Ref<HTMLElement | null>;
  hasError: Ref<boolean>;
  hasFilters: Ref<boolean>;
  hasNoContributions: Ref<boolean>;
  hasResults: Ref<boolean>;
  isLoading: Ref<boolean>;
  resetFilters: () => Promise<void>;
}

/** Owns first-page announcements and focus after a filter reset hides or removes its button. */
function useContributionFeedback(options: ContributionFeedbackOptions) {
  const announcement = computed(() => {
    if (options.hasError.value) {
      if (options.hasResults.value || options.isLoading.value) {
        return 'Some contributions could not be loaded. Retry the affected section.'
      }

      return 'Could not load contributions. Try again.'
    }

    if (options.isLoading.value) {
      return 'Loading contributions.'
    }

    if (options.hasNoContributions.value) {
      if (options.hasFilters.value) {
        return 'No matching contributions.'
      }

      return 'No contributions yet.'
    }

    return 'Contributions loaded.'
  })

  async function handleClearFilters(event: MouseEvent) {
    const resetButton = event.currentTarget
    const ownedFocus = resetButton === globalThis.document.activeElement

    await options.resetFilters()
    await nextTick()

    const { activeElement } = globalThis.document
    const focusHasNotMoved = activeElement === resetButton || activeElement === globalThis.document.body

    // A reset hidden with CSS can still own focus until the next browser paint.
    if (ownedFocus && focusHasNotMoved) {
      const typeControl = options.filtersPanel.value?.querySelector<HTMLInputElement>('input:checked')

      typeControl?.focus()
    }
  }

  return {
    announcement,
    handleClearFilters
  }
}

export { useContributionFeedback }
