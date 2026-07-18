<template>
  <PageContent :page-title="navigationLabels.gearLibrary">
    <div :class="$style.component">
      <GearLibraryFilters
        v-model:draft-filters="draftFilters"
        v-model:is-dialog-open="isFilterDialogOpen"
        :applied-filter-chips="appliedFilterChips"
        :applied-filter-count="appliedFilterCount"
        :brands="brandOptions"
        :draft-filter-count="draftFilterCount"
        :has-brands-unavailable="hasBrandsUnavailable"
        :has-draft-changes="hasDraftChanges"
        :has-draft-filters="hasDraftFilters"
        :has-number-range-errors="hasNumberRangeErrors"
        :has-properties-unavailable="hasCategoryDetailUnavailable"
        :has-selected-category="hasSelectedCategory"
        :is-brands-pending="isBrandsPending"
        :is-properties-pending="isCategoryDetailPending"
        :number-range-errors="numberRangeErrors"
        :properties="filterProperties"
        @apply="handleApplyFilters"
        @cancel="handleCancelFilters"
        @clear-applied="handleClearAppliedFilters"
        @open="handleOpenFilters"
        @remove="handleRemoveFilter"
        @retry-brands="refreshBrands"
        @retry-properties="refreshCategoryDetail"
      >
        <template #controls>
          <GearLibrarySearchControls
            v-model:search-value="searchValue"
            :categories="categoryOptions"
            :category-value="selectedCategoryValue"
            :has-categories-unavailable="hasCategoriesUnavailable"
            :has-category-detail-unavailable="hasCategoryDetailUnavailable"
            :is-category-disabled="isCategoryDisabled"
            :is-category-pending="isCategoryPending"
            :is-ordering-pending="isCategoryDetailPending"
            :ordering-options="orderingOptions"
            :ordering-value="orderingValue"
            @category-change="handleCategoryChange"
            @ordering-change="handleOrderingChange"
            @retry-categories="refreshCategories"
            @retry-category-detail="refreshCategoryDetail"
          />
        </template>

        <template #results-summary>
          <PageSummaryHeader
            v-if="hasSuccessfulItemsRequest"
            label="Results"
            :value="itemsSummaryText"
          />
        </template>

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
              <PerdButton variant="secondary" @click="refreshItems">
                Retry
              </PerdButton>
            </template>
          </PagePlaceholder>

          <template v-else-if="hasSuccessfulItemsRequest">
            <div v-if="hasRefreshItemsError" :class="$style.refreshError" role="alert">
              <p>
                Could not refresh results.
              </p>

              <PerdButton size="small" variant="secondary" @click="refreshItems">
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
                Try changing the search, category, or filters.
              </PagePlaceholder>

              <GearLibraryResultsPanel
                v-else
                :items="gearLibraryItems"
              />
            </div>

            <GearLibraryLoadMore
              :has-error="hasLoadMoreError"
              :is-loading="isLoadingMore"
              :is-visible="showLoadMore"
              @load-more="loadMore"
              @retry="retryLoadMore"
            />

            <p
              :class="$style.visuallyHidden"
              data-testid="gear-library-load-more-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {{ loadMoreAnnouncement }}
            </p>
          </template>
        </div>
      </GearLibraryFilters>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta } from '#imports'
  import { useDelayedPendingIndicator } from '~/composables/use-delayed-pending-indicator'
  import { useGearLibraryControls } from '~/composables/use-gear-library-controls'
  import { useGearLibraryData } from '~/composables/use-gear-library-data'
  import { useGearLibraryFilters } from '~/composables/use-gear-library-filters'
  import { useGearLibraryRoute } from '~/composables/use-gear-library-route'
  import { useGearLibraryBrowsingRestoration } from '~/composables/use-gear-library-browsing-restoration'
  import { createGearLibraryAppliedFilterChips } from '~/utils/gear-library-filters'
  import { createGearLibraryItemPath, navigationLabels } from '~/utils/navigation'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PageSummaryHeader from '~/components/PageSummaryHeader.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdProgressBar from '~/components/PerdProgressBar.vue'
  import GearLibraryFilters from '~/components/gear-library/GearLibraryFilters.vue'
  import GearLibraryLoadMore from '~/components/gear-library/GearLibraryLoadMore.vue'
  import GearLibraryResultsPanel from '~/components/gear-library/GearLibraryResultsPanel.vue'
  import GearLibraryResultsSkeleton from '~/components/gear-library/GearLibraryResultsSkeleton.vue'
  import GearLibrarySearchControls from '~/components/gear-library/GearLibrarySearchControls.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page',
    middleware: ['gear-library-query'],
    scrollToTop: false,
    viewTransition: false
  })

  const {
    handleCategoryChange,
    handleFiltersChange,
    handleOrderingChange,
    itemsApiQuery,
    itemsApiQuerySignature,
    routeState,
    searchValue,
    selectedCategory,
    selectedCategoryValue
  } = useGearLibraryRoute()

  const {
    connectBrowsingState,
    hasSavedBrowsingState,
    loadedPageCount
  } = useGearLibraryBrowsingRestoration()

  const {
    appliedFilterCount,
    appliedFilters,
    draftFilterCount,
    draftFilters,
    handleApplyFilters,
    handleCancelFilters,
    handleClearAppliedFilters,
    handleOpenFilters,
    handleRemoveFilter,
    hasDraftChanges,
    hasDraftFilters,
    hasNumberRangeErrors,
    isFilterDialogOpen,
    numberRangeErrors
  } = useGearLibraryFilters({
    handleFiltersChange,
    routeState
  })

  const hasNarrowingState = computed(() => {
    const state = routeState.value

    return state.q !== ''
      || state.category !== undefined
      || state.brand.length > 0
      || state.number.length > 0
      || state.enum.length > 0
      || state.boolean.length > 0
  })

  const hasSelectedCategory = computed(() => selectedCategory.value !== undefined)

  const {
    activeCategoryDetail,
    brandsError,
    brandsResponse,
    brandsStatus,
    canLoadMore,
    canRestoreSavedBrowsingState,
    categoriesError,
    categoriesResponse,
    categoriesStatus,
    categoryDetailError,
    categoryDetailStatus,
    hasBrandsData,
    hasCategoriesData,
    hasLoadMoreError,
    hasSuccessfulItemsRequest,
    isBrowsingStateReady,
    isLoadingMore,
    itemsError,
    itemsStatus,
    lastSuccessfulHasNarrowingState,
    lastSuccessfulItemsResponse,
    loadMore,
    loadMoreAnnouncement,
    refreshBrands,
    refreshCategories,
    refreshCategoryDetail,
    refreshItems,
    retryLoadMore
  } = await useGearLibraryData({
    hasSavedBrowsingState,
    loadedPageCount,
    hasNarrowingState,
    itemsApiQuery,
    itemsApiQuerySignature,
    selectedCategory
  })

  connectBrowsingState(isBrowsingStateReady, canRestoreSavedBrowsingState)

  const {
    categoryOptions,
    orderingOptions,
    orderingValue
  } = useGearLibraryControls({
    categories: () => categoriesResponse.value,
    categoriesStatus: () => categoriesStatus.value,
    categoryDetail: () => activeCategoryDetail.value,
    categoryDetailStatus: () => categoryDetailStatus.value,
    handleCategoryChange,
    handleOrderingChange,
    routeState,
    selectedCategory
  })

  const hasItemsError = computed(() => itemsError.value !== undefined && itemsError.value !== null)

  const hasBrandsUnavailable = computed(() => {
    const hasRequestError = brandsError.value !== undefined && brandsError.value !== null

    return hasRequestError && hasBrandsData.value === false
  })

  const hasCategoriesError = computed(() => categoriesError.value !== undefined && categoriesError.value !== null)

  const hasCategoriesUnavailable = computed(
    () => hasCategoriesError.value && hasCategoriesData.value === false
  )

  const hasCategoryDetailError = computed(() => {
    const hasRequestError = categoryDetailError.value !== undefined && categoryDetailError.value !== null

    return hasSelectedCategory.value && hasRequestError
  })

  const isItemsPending = computed(() => itemsStatus.value === 'idle' || itemsStatus.value === 'pending')
  const isInitialLoading = computed(() => isItemsPending.value && hasSuccessfulItemsRequest.value === false)
  const isRefreshing = computed(() => itemsStatus.value === 'pending' && hasSuccessfulItemsRequest.value)
  const hasInitialItemsError = computed(() => hasItemsError.value && hasSuccessfulItemsRequest.value === false)
  const hasRefreshItemsError = computed(() => hasItemsError.value && hasSuccessfulItemsRequest.value)
  const isCategoriesLoading = computed(() => categoriesStatus.value === 'idle' || categoriesStatus.value === 'pending')

  const isBrandsPending = computed(() => {
    const isRequestPending = brandsStatus.value === 'idle' || brandsStatus.value === 'pending'

    return isRequestPending && hasBrandsData.value === false
  })

  const isCategoryPending = computed(() => isCategoriesLoading.value && hasCategoriesData.value === false)

  const isCategoryDisabled = computed(
    () => isCategoryPending.value || (hasCategoriesUnavailable.value && selectedCategory.value === undefined)
  )

  const isCategoryDetailLoading = computed(() => {
    const isRequestPending = categoryDetailStatus.value === 'idle' || categoryDetailStatus.value === 'pending'

    return hasSelectedCategory.value && isRequestPending
  })

  const hasActiveCategoryDetail = computed(() => {
    const categorySlug = selectedCategory.value
    const categoryDetail = activeCategoryDetail.value

    return categorySlug !== undefined && categoryDetail?.slug === categorySlug
  })

  const isCategoryDetailPending = computed(
    () => isCategoryDetailLoading.value && hasActiveCategoryDetail.value === false
  )

  const hasCategoryDetailUnavailable = computed(
    () => hasCategoryDetailError.value && hasActiveCategoryDetail.value === false
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

  const isEmptyCatalog = computed(
    () => lastSuccessfulItemsResponse.value.total === 0 && lastSuccessfulHasNarrowingState.value === false
  )

  const hasNoMatches = computed(
    () => lastSuccessfulItemsResponse.value.total === 0 && lastSuccessfulHasNarrowingState.value
  )

  const itemsSummaryText = computed(() => {
    const itemCount = lastSuccessfulItemsResponse.value.total
    const itemLabel = itemCount === 1 ? 'item' : 'items'

    return `${itemCount} ${itemLabel}`
  })

  const showLoadMore = computed(
    () => isBrowsingStateReady.value && (canLoadMore.value || isLoadingMore.value)
  )

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

  const brandOptions = computed(() => brandsResponse.value.map((brand) => {
    return {
      name: brand.name,
      slug: brand.slug
    }
  }))

  const filterProperties = computed(() => {
    const categoryDetail = activeCategoryDetail.value

    if (categoryDetail === null || categoryDetail.slug !== selectedCategory.value) {
      return []
    }

    return categoryDetail.properties
  })

  const appliedFilterChips = computed(() => createGearLibraryAppliedFilterChips(
    appliedFilters.value,
    {
      brands: brandOptions.value,
      properties: filterProperties.value
    }
  ))

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
