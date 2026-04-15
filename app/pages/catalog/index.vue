<template>
  <PageContent page-title="Catalog">
    <div :class="$style.component">
      <PerdCard v-if="isInitialLoading" :class="$style.stateCard">
        <div :class="$style.stateBody">
          <FidgetSpinner :class="$style.spinner" />

          <PerdHeading :level="2">
            Loading catalog
          </PerdHeading>

          <p :class="$style.stateText">
            We are loading items for this page.
          </p>
        </div>
      </PerdCard>

      <PagePlaceholder v-else-if="hasError" emoji="🧭" title="Catalog is temporarily unavailable.">
        We could not load the catalog right now. Try this request again.

        <template #actions>
          <PerdButton secondary @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.results">
        <div :class="$style.resultsHeader">
          <p :class="$style.resultsSummary">
            <span :class="$style.resultsSummaryLabel">
              Catalog
            </span>

            <strong :class="$style.resultsSummaryValue">
              {{ itemsSummaryText }}
            </strong>
          </p>
        </div>

        <PagePlaceholder v-if="isEmpty" emoji="🧺" title="No items yet.">
          We do not have any items to show here yet.
        </PagePlaceholder>

        <div v-else :class="$style.resultsPanel">
          <PagePlaceholder v-if="isOutOfRangePage" emoji="🗺️" title="This page is out of range.">
            There are catalog items here, but this page number is no longer valid.

            <template #actions>
              <PerdButton secondary @click="handlePageChange(totalPages)">
                Go to last page
              </PerdButton>
            </template>
          </PagePlaceholder>

          <div
            v-else
            :class="$style.tableShell"
            :aria-busy="showResultsLoadingOverlay ? 'true' : 'false'"
          >
            <div v-if="showResultsLoadingOverlay" :class="$style.loadingOverlay">
              <p :class="$style.loadingBadge" role="status" aria-label="Loading page" aria-live="polite">
                <FidgetSpinner :class="$style.loadingSpinner" />
                Loading page
              </p>
            </div>

            <div :class="$style.tableWrapper">
              <table :class="$style.resultsTable">
                <thead>
                  <tr>
                    <th :class="$style.tableHeading" scope="col">
                      Name
                    </th>

                    <th :class="$style.tableHeading" scope="col">
                      Brand
                    </th>

                    <th :class="$style.tableHeading" scope="col">
                      Category
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="item in itemsResponse.items" :key="item.id">
                    <td :class="$style.tableCell">
                      {{ item.name }}
                    </td>

                    <td :class="$style.tableCell">
                      {{ item.brand.name }}
                    </td>

                    <td :class="$style.tableCell">
                      {{ item.category.name }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="showPagination" :class="$style.pagination">
            <PerdButton
              small
              secondary
              :disabled="!canGoPrevious || shouldDisablePaginationControls"
              @click="handlePageChange(itemsResponse.page - 1)"
            >
              Previous
            </PerdButton>

            <p :class="$style.paginationText">
              Page {{ itemsResponse.page }} of {{ totalPages }}
            </p>

            <PerdButton
              small
              secondary
              :disabled="!canGoNext || shouldDisablePaginationControls"
              @click="handlePageChange(itemsResponse.page + 1)"
            >
              Next
            </PerdButton>
          </div>
        </div>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useRoute } from '#imports'
  import { buildCatalogRouteQuery, getCatalogItemsApiQuery, getCatalogRouteState } from '~/utils/catalog'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
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
  } = await useFetch('/api/equipment/items', {
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
  const showResultsLoadingOverlay = computed(() => isRefreshing.value)
  const shouldDisablePaginationControls = computed(() => isRefreshing.value)

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
</script>

<style module>
  .component {
    display: grid;
  }

  .stateCard {
    min-height: min(60vh, 32rem);
    display: grid;
    place-items: center;
  }

  .stateBody {
    display: grid;
    gap: var(--spacing-16);
    justify-items: center;
    text-align: center;
  }

  .spinner {
    font-size: 2rem;
  }

  .stateText {
    margin: 0;
    max-width: 28rem;
    color: var(--color-text-secondary);
  }

  .results {
    display: grid;
    gap: var(--spacing-24);
  }

  .resultsHeader {
    display: flex;
    align-items: center;
  }

  .resultsSummary {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-12);
    margin: 0;
    padding: var(--spacing-12) var(--spacing-16);
    border: 1px solid var(--color-background-200);
    border-radius: 999px;
    background:
      linear-gradient(
        135deg,
        color-mix(in oklch, var(--color-primary), transparent 88%),
        var(--color-background-50)
      );
  }

  .resultsSummaryLabel {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
  }

  .resultsSummaryValue {
    color: var(--color-text);
  }

  .tableShell {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--color-background-200);
    border-radius: var(--border-radius-12);
    background-color: var(--color-background);
  }

  .tableWrapper {
    overflow-x: auto;
  }

  .resultsTable {
    width: 100%;
    min-width: 32rem;
    border-collapse: collapse;
  }

  .loadingOverlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background-color: color-mix(in oklch, var(--color-background), transparent 18%);
    backdrop-filter: blur(0.35rem);
  }

  .loadingBadge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-8);
    margin: 0;
    padding: var(--spacing-12) var(--spacing-16);
    border: 1px solid var(--color-background-200);
    border-radius: 999px;
    background-color: color-mix(in oklch, var(--color-background-50), transparent 8%);
    color: var(--color-text);
  }

  .loadingSpinner {
    font-size: 1rem;
  }

  .tableHeading {
    padding: var(--spacing-16) var(--spacing-24);
    border-bottom: 1px solid var(--color-background-300);
    text-align: left;
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    background-color: color-mix(in oklch, var(--color-background-50), var(--color-background) 55%);
  }

  .tableCell {
    padding: var(--spacing-16) var(--spacing-24);
    border-bottom: 1px solid var(--color-background-200);
    color: var(--color-text);
    vertical-align: top;

    &:first-child {
      font-weight: var(--font-weight-medium);
    }
  }

  .pagination {
    display: grid;
    gap: var(--spacing-12);
    align-items: center;
    padding-top: var(--spacing-16);

    @media (width >= 40rem) {
      grid-template-columns: auto auto auto;
      justify-content: space-between;
    }
  }

  .paginationText {
    margin: 0;
    color: var(--color-text-secondary);
    text-align: center;
  }
</style>
