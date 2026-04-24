<template>
  <PageContent page-title="Catalog">
    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading catalog"
        description="We are loading items for this page."
      />

      <PagePlaceholder v-else-if="hasError" emoji="🧭" title="Catalog is temporarily unavailable.">
        We could not load the catalog right now. Try this request again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.results">
        <div :class="$style.resultsHeader">
          <div>
            <p :class="$style.resultsSummaryLabel">
              Catalog
            </p>

            <p :class="$style.resultsSummaryValue">
              {{ itemsSummaryText }}
            </p>
          </div>

          <p :class="$style.resultsCopy">
            Approved gear entries ready for inventory tracking.
          </p>
        </div>

        <PagePlaceholder v-if="isEmpty" emoji="🧺" title="No items yet.">
          We do not have any items to show here yet.
        </PagePlaceholder>

        <CatalogResultsPanel
          v-else
          :items="catalogItems"
          :is-out-of-range-page="isOutOfRangePage"
          :show-loading-overlay="showResultsLoadingOverlay"
          @go-last="handleGoToLastPage"
        />

        <CatalogPagination
          :is-visible="showPagination"
          :page="itemsResponse.page"
          :total-pages="totalPages"
          :is-previous-disabled="isPreviousPageDisabled"
          :is-next-disabled="isNextPageDisabled"
          @previous="handleGoToPreviousPage"
          @next="handleGoToNextPage"
        />
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useRoute } from '#imports'
  import type { CatalogItemsResponse } from '~/types/equipment'
  import { buildCatalogRouteQuery, getCatalogItemsApiQuery, getCatalogRouteState } from '~/utils/catalog'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import CatalogPagination from '~/components/catalog/CatalogPagination.vue'
  import CatalogResultsPanel from '~/components/catalog/CatalogResultsPanel.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const routeState = computed(() => getCatalogRouteState(route.query))
  const itemsApiQuery = computed(() => getCatalogItemsApiQuery(route.query))

  const {
    data: itemsResponse,
    error: itemsError,
    refresh: refreshItems,
    status: itemsStatus
  } = await useFetch<CatalogItemsResponse>('/api/equipment/items', {
    default: () => {
      return {
        items: [],
        limit: 20,
        page: 1,
        total: 0
      }
    },

    query: itemsApiQuery
  })

  const hasError = computed(() => itemsError.value !== undefined && itemsError.value !== null)
  const totalPages = computed(() => Math.max(Math.ceil(itemsResponse.value.total / itemsResponse.value.limit), 1))
  const isLoading = computed(() => itemsStatus.value === 'pending')
  const hasRenderedResults = computed(() => itemsResponse.value.items.length > 0 || itemsResponse.value.total > 0)
  const isInitialLoading = computed(() => isLoading.value && hasRenderedResults.value === false)
  const isRefreshing = computed(() => isLoading.value && hasRenderedResults.value)
  const isEmpty = computed(() => itemsResponse.value.total === 0)
  const isOutOfRangePage = computed(() => itemsResponse.value.total > 0 && itemsResponse.value.items.length === 0)
  const itemsSummaryText = computed(() => `${itemsResponse.value.total} ${itemsResponse.value.total === 1 ? 'item' : 'items'}`)
  const canGoPrevious = computed(() => itemsResponse.value.page > 1)
  const canGoNext = computed(() => itemsResponse.value.page < totalPages.value)
  const showPagination = computed(() => totalPages.value > 1 && isEmpty.value === false)
  const catalogItems = computed(() => itemsResponse.value.items.map((item) => {
    return {
      brand: item.brand,
      category: item.category,
      detailPath: `/catalog/${item.id}`,
      id: item.id,
      name: item.name
    }
  }))
  const showResultsLoadingOverlay = computed(() => isRefreshing.value)
  const shouldDisablePaginationControls = computed(() => isRefreshing.value)
  const isPreviousPageDisabled = computed(() => canGoPrevious.value === false || shouldDisablePaginationControls.value)
  const isNextPageDisabled = computed(() => canGoNext.value === false || shouldDisablePaginationControls.value)

  async function handlePageChange(page: number) {
    const currentPage = routeState.value.page

    if (page === currentPage || shouldDisablePaginationControls.value) {
      return
    }

    await navigateTo({
      path: route.path,

      query: buildCatalogRouteQuery({
        page
      })
    })
  }

  async function handleRetry() {
    await refreshItems()
  }

  async function handleGoToLastPage() {
    await handlePageChange(totalPages.value)
  }

  async function handleGoToPreviousPage() {
    await handlePageChange(itemsResponse.value.page - 1)
  }

  async function handleGoToNextPage() {
    await handlePageChange(itemsResponse.value.page + 1)
  }
</script>

<style module>
  .component {
    display: grid;
  }

  .results {
    display: grid;
    gap: var(--spacing-24);
  }

  .resultsHeader {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-16);
    align-items: end;
  }

  .resultsSummaryLabel {
    margin: 0 0 var(--spacing-8);
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .resultsSummaryValue {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-24);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
  }

  .resultsCopy {
    margin: 0;
    color: var(--color-text-tertiary);
    max-width: 24rem;
    text-align: right;
  }

  @media (width < 640px) {
    .resultsCopy {
      text-align: left;
    }
  }
</style>
