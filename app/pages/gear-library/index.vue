<template>
  <PageContent :page-title="navigationLabels.gearLibrary">
    <div :class="$style.component">
      <GearLibrarySearchControls
        v-model:search-value="searchValue"
        :categories="categoryOptions"
        :category-value="selectedCategoryValue"
        :direction-value="routeState.direction"
        :has-categories-error="hasCategoriesError"
        :has-category-detail-error="hasCategoryDetailError"
        :is-category-pending="isCategoryPending"
        :is-sort-pending="isSortPending"
        :sort-options="sortOptions"
        :sort-value="routeState.sort"
        @category-change="handleCategoryChange"
        @direction-change="handleDirectionChange"
        @retry-categories="handleRetryCategories"
        @retry-category-detail="handleRetryCategoryDetail"
        @sort-change="handleSortChange"
      />

      <div :class="$style.results">
        <div
          v-if="showInitialLoadingSurface"
          :class="$style.initialState"
          :aria-busy="initialAriaBusy"
        >
          <GearLibraryResultsSkeleton :visible="showInitialLoadingIndicator" />

          <PerdProgressBar
            :class="$style.progress"
            :is-complete="isInitialIndicatorComplete"
            :visible="showInitialLoadingIndicator"
            data-testid="gear-library-initial-progress"
            aria-hidden="true"
          />

          <p
            v-if="showInitialLoadingIndicator"
            :class="$style.visuallyHidden"
            role="status"
            aria-live="polite"
          >
            Loading gear library
          </p>
        </div>

        <PagePlaceholder
          v-else-if="hasInitialItemsError"
          data-testid="gear-library-initial-error"
          emoji="🧭"
          full-width
          title="Gear library unavailable."
        >
          Try again.

          <template #actions>
            <PerdButton variant="secondary" @click="handleRetryItems">
              Retry
            </PerdButton>
          </template>
        </PagePlaceholder>

        <template v-else-if="hasSuccessfulItemsRequest">
          <PageSummaryHeader label="Results" :value="itemsSummaryText" />

          <div v-if="hasRefreshItemsError" :class="$style.refreshError" role="alert">
            <p>
              Could not refresh results.
            </p>

            <PerdButton size="small" variant="secondary" @click="handleRetryItems">
              Retry
            </PerdButton>
          </div>

          <div
            :class="$style.resultsBody"
            :aria-busy="refreshAriaBusy"
            data-testid="gear-library-results-body"
          >
            <PerdProgressBar
              :class="$style.progress"
              :is-complete="isRefreshIndicatorComplete"
              :visible="showRefreshIndicator"
              data-testid="gear-library-refresh-progress"
              aria-hidden="true"
            />

            <p
              v-if="showRefreshIndicator"
              :class="$style.visuallyHidden"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {{ refreshStatusText }}
            </p>

            <PagePlaceholder
              v-if="isEmptyCatalog"
              data-testid="gear-library-results-state"
              emoji="🧺"
              full-width
              title="No items yet."
            />

            <PagePlaceholder
              v-else-if="hasNoMatches"
              data-testid="gear-library-results-state"
              emoji="🔎"
              full-width
              title="No matching gear."
            >
              Try changing the search or category.
            </PagePlaceholder>

            <GearLibraryResultsPanel
              v-else
              :items="gearLibraryItems"
              :is-out-of-range-page="isOutOfRangePage"
              @go-last="handleGoToLastPage"
            />
          </div>

          <GearLibraryPagination
            :is-visible="showPagination"
            :page="lastSuccessfulItemsResponse.page"
            :total-pages="totalPages"
            :is-previous-disabled="isPreviousPageDisabled"
            :is-next-disabled="isNextPageDisabled"
            @previous="handleGoToPreviousPage"
            @next="handleGoToNextPage"
          />
        </template>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta } from '#imports'

  import type { GearLibrarySort } from '~/utils/gear-library'
  import { useDelayedPendingIndicator } from '~/composables/use-delayed-pending-indicator'
  import { useGearLibraryData } from '~/composables/use-gear-library-data'
  import { useGearLibraryRoute } from '~/composables/use-gear-library-route'
  import { createGearLibraryItemPath, navigationLabels } from '~/utils/navigation'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PageSummaryHeader from '~/components/PageSummaryHeader.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdProgressBar from '~/components/PerdProgressBar.vue'
  import GearLibraryPagination from '~/components/gear-library/GearLibraryPagination.vue'
  import GearLibraryResultsPanel from '~/components/gear-library/GearLibraryResultsPanel.vue'
  import GearLibraryResultsSkeleton from '~/components/gear-library/GearLibraryResultsSkeleton.vue'
  import GearLibrarySearchControls from '~/components/gear-library/GearLibrarySearchControls.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  interface CategoryOption {
    name: string;
    slug: string;
  }

  interface SortOption {
    label: string;
    value: GearLibrarySort;
  }

  definePageMeta({
    layout: 'page',
    middleware: ['gear-library-query']
  })

  const categoryNameCollator = new Intl.Collator('en')

  const {
    currentPage,
    handleCategoryChange,
    handleDirectionChange,
    handleSortChange,
    itemsApiQuery,
    itemsApiQuerySignature,
    routeState,
    searchValue,
    selectedCategory,
    selectedCategoryValue
  } = useGearLibraryRoute()

  const hasNarrowingState = computed(() => {
    const state = routeState.value

    return state.q !== ''
      || state.category !== undefined
      || state.brand.length > 0
      || state.number.length > 0
      || state.enum.length > 0
      || state.boolean.length > 0
  })

  const {
    activeCategoryDetail,
    categoriesError,
    categoriesResponse,
    categoriesStatus,
    categoryDetailError,
    categoryDetailStatus,
    hasCategoriesData,
    hasSuccessfulItemsRequest,
    itemsError,
    itemsStatus,
    lastSuccessfulHasNarrowingState,
    lastSuccessfulItemsResponse,
    refreshCategories,
    refreshCategoryDetail,
    refreshItems
  } = await useGearLibraryData({
    hasNarrowingState,
    itemsApiQuery,
    itemsApiQuerySignature,
    selectedCategory
  })

  const hasItemsError = computed(() => itemsError.value !== undefined && itemsError.value !== null)
  const hasCategoriesError = computed(() => categoriesError.value !== undefined && categoriesError.value !== null)

  const hasCategoryDetailError = computed(() => {
    const hasSelectedCategory = selectedCategory.value !== undefined
    const hasRequestError = categoryDetailError.value !== undefined && categoryDetailError.value !== null

    return hasSelectedCategory && hasRequestError
  })

  const isItemsPending = computed(() => itemsStatus.value === 'idle' || itemsStatus.value === 'pending')
  const isInitialLoading = computed(() => isItemsPending.value && hasSuccessfulItemsRequest.value === false)
  const isRefreshing = computed(() => itemsStatus.value === 'pending' && hasSuccessfulItemsRequest.value)
  const hasInitialItemsError = computed(() => hasItemsError.value && hasSuccessfulItemsRequest.value === false)
  const hasRefreshItemsError = computed(() => hasItemsError.value && hasSuccessfulItemsRequest.value)
  const isCategoriesLoading = computed(() => categoriesStatus.value === 'idle' || categoriesStatus.value === 'pending')
  const isCategoryPending = computed(() => isCategoriesLoading.value && hasCategoriesData.value === false)

  const isCategoryDetailLoading = computed(() => {
    const hasSelectedCategory = selectedCategory.value !== undefined
    const isRequestPending = categoryDetailStatus.value === 'idle' || categoryDetailStatus.value === 'pending'

    return hasSelectedCategory && isRequestPending
  })

  const hasActiveCategoryDetail = computed(() => {
    const categorySlug = selectedCategory.value
    const categoryDetail = activeCategoryDetail.value

    return categorySlug !== undefined && categoryDetail?.slug === categorySlug
  })

  const isSortPending = computed(
    () => isCategoryDetailLoading.value && hasActiveCategoryDetail.value === false
  )

  const showInitialLoadingIndicator = useDelayedPendingIndicator(isInitialLoading, {
    delayMs: 200,
    minimumVisibleMs: 300
  })

  const showInitialLoadingSurface = computed(
    () => isInitialLoading.value || showInitialLoadingIndicator.value
  )

  const initialAriaBusy = computed(() => showInitialLoadingSurface.value || undefined)

  const isInitialIndicatorComplete = computed(
    () => showInitialLoadingIndicator.value && isInitialLoading.value === false
  )

  const showRefreshIndicator = useDelayedPendingIndicator(isRefreshing, {
    delayMs: 400,
    minimumVisibleMs: 200
  })

  const refreshAriaBusy = computed(() => isRefreshing.value || undefined)

  const isRefreshIndicatorComplete = computed(
    () => showRefreshIndicator.value && isRefreshing.value === false
  )

  const refreshStatusText = computed(
    () => isRefreshing.value ? 'Refreshing results' : 'Results refreshed'
  )

  const totalPages = computed(() => {
    const response = lastSuccessfulItemsResponse.value

    return Math.max(Math.ceil(response.total / response.limit), 1)
  })

  const isEmptyCatalog = computed(
    () => lastSuccessfulItemsResponse.value.total === 0 && lastSuccessfulHasNarrowingState.value === false
  )

  const hasNoMatches = computed(
    () => lastSuccessfulItemsResponse.value.total === 0 && lastSuccessfulHasNarrowingState.value
  )

  const isOutOfRangePage = computed(() => {
    const response = lastSuccessfulItemsResponse.value

    return response.total > 0 && response.items.length === 0
  })

  const itemsSummaryText = computed(() => {
    const itemCount = lastSuccessfulItemsResponse.value.total
    const itemLabel = itemCount === 1 ? 'item' : 'items'

    return `${itemCount} ${itemLabel}`
  })

  const canGoPrevious = computed(() => lastSuccessfulItemsResponse.value.page > 1)
  const canGoNext = computed(() => lastSuccessfulItemsResponse.value.page < totalPages.value)
  const showPagination = computed(() => totalPages.value > 1 && lastSuccessfulItemsResponse.value.total > 0)
  const isPreviousPageDisabled = computed(() => canGoPrevious.value === false || isRefreshing.value)
  const isNextPageDisabled = computed(() => canGoNext.value === false || isRefreshing.value)

  const gearLibraryItems = computed(() => lastSuccessfulItemsResponse.value.items.map((item) => {
    const detailPath = createGearLibraryItemPath(item.id)

    return {
      brand: item.brand,
      category: item.category,
      detailPath,
      id: item.id,
      name: item.name,
      properties: item.properties
    }
  }))

  const categoryOptions = computed<CategoryOption[]>(() => {
    const options = categoriesResponse.value.map((category) => {
      return {
        name: category.name,
        slug: category.slug
      }
    })

    const currentSlug = selectedCategory.value

    if (currentSlug !== undefined) {
      const hasCurrentCategory = options.some((category) => category.slug === currentSlug)

      if (hasCurrentCategory === false) {
        const detailMatchesCurrent = activeCategoryDetail.value?.slug === currentSlug

        const currentName = detailMatchesCurrent
          ? activeCategoryDetail.value?.name ?? currentSlug
          : currentSlug

        options.push({
          name: currentName,
          slug: currentSlug
        })
      }
    }

    return options.toSorted((left, right) => categoryNameCollator.compare(left.name, right.name))
  })

  const sortOptions = computed<SortOption[]>(() => {
    const options: SortOption[] = [{
      label: 'Name',
      value: 'name'
    }, {
      label: 'Brand',
      value: 'brand'
    }]

    const currentCategory = selectedCategory.value
    const categoryDetail = activeCategoryDetail.value
    const detailMatchesCurrent = categoryDetail?.slug === currentCategory

    if (detailMatchesCurrent && categoryDetail !== null) {
      const numberProperties = categoryDetail.properties.filter((property) => property.dataType === 'number')

      for (const property of numberProperties) {
        const hasUnit = property.unit !== null && property.unit !== ''
        const label = hasUnit ? `${property.name} (${property.unit})` : property.name
        const value: GearLibrarySort = `property:${property.slug}`

        options.push({ label, value })
      }
    }

    const currentSort = routeState.value.sort
    const hasCurrentSort = options.some((option) => option.value === currentSort)
    const isPropertySort = currentSort.startsWith('property:')

    if (hasCurrentSort === false && isPropertySort) {
      const propertySlug = currentSort.slice('property:'.length)

      options.push({
        label: `Property: ${propertySlug}`,
        value: currentSort
      })
    }

    return options
  })

  async function handleRetryItems() {
    await refreshItems()
  }

  async function handleRetryCategories() {
    await refreshCategories()
  }

  async function handleRetryCategoryDetail() {
    await refreshCategoryDetail()
  }

  function handlePageChange(page: number) {
    const isSamePage = page === currentPage.value

    if (isSamePage || isRefreshing.value) {
      return
    }

    currentPage.value = page
  }

  function handleGoToLastPage() {
    handlePageChange(totalPages.value)
  }

  function handleGoToPreviousPage() {
    handlePageChange(lastSuccessfulItemsResponse.value.page - 1)
  }

  function handleGoToNextPage() {
    handlePageChange(lastSuccessfulItemsResponse.value.page + 1)
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-32);
    container-type: inline-size;
  }

  .results {
    display: grid;
    gap: var(--spacing-24);
  }

  .initialState {
    position: relative;
    min-inline-size: 0;
    min-block-size: var(--spacing-48);
    inline-size: 100%;
  }

  .resultsBody {
    position: relative;
    min-inline-size: 0;
    min-block-size: 14rem;
    inline-size: 100%;
  }

  .progress {
    position: absolute;
    z-index: 1;
    inset-block-start: 0;
    inset-inline: 0;
  }

  .visuallyHidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    border: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .refreshError {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    padding: var(--spacing-12) var(--spacing-16);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--border-radius-16);
    background: var(--color-danger-subtle);
    color: var(--color-danger-primary);
  }
</style>
