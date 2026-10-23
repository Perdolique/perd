import { computed, nextTick, type Ref } from 'vue'

interface ContributionFeedbackOptions {
  filtersPanel: Ref<HTMLElement | null>;
  hasError: Ref<boolean>;
  hasFilters: Ref<boolean>;
  hasNoContributions: Ref<boolean>;
  isLoading: Ref<boolean>;
  resetFilters: () => Promise<void>;
}

/** Owns first-page announcements and focus after a filter reset removes its button. */
function useContributionFeedback(options: ContributionFeedbackOptions) {
  const announcement = computed(() => {
    if (options.isLoading.value) {
      return 'Loading contributions.'
    }

    if (options.hasError.value) {
      return 'Could not load contributions. Try again.'
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

    // Do not move focus if another action has already placed it elsewhere.
    if (ownedFocus && globalThis.document.activeElement === globalThis.document.body) {
      const statusControl = options.filtersPanel.value?.querySelector<HTMLButtonElement>('[role="combobox"]')

      statusControl?.focus()
    }
  }

  return {
    announcement,
    handleClearFilters
  }
}

export { useContributionFeedback }
