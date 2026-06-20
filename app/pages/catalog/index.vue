<template>
  <PageContent page-title="Catalog">
    <template #actions>
      <PerdButton icon="tabler:plus" @click="openSubmissionDialog">
        Add gear
      </PerdButton>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading catalog"
      />

      <PagePlaceholder v-else-if="hasError" emoji="🧭" title="Catalog unavailable.">
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.results">
        <p v-if="submittedItem" :class="$style.successMessage" role="status">
          Submitted
          <PerdLink :to="submittedItemPath">
            {{ submittedItem.name }}
          </PerdLink>
          for review. It is in your inventory now.
        </p>

        <PageSummaryHeader label="Catalog" :value="itemsSummaryText" />

        <PagePlaceholder v-if="isEmpty" emoji="🧺" title="No items yet." />

        <CatalogResultsPanel
          v-else
          :items="catalogItems"
          :is-out-of-range-page="isOutOfRangePage"
          :show-loading-overlay="isRefreshing"
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

    <EquipmentItemSubmissionDialog
      v-model="isSubmissionDialogVisible"
      @submitted="handleSubmissionSubmitted"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useRoute } from '#imports'
  import type { ItemSubmissionCreateResponse, SubmittedCatalogItem } from '~/types/equipment'
  import { buildCatalogRouteQuery, getCatalogItemsApiQuery, getCatalogRouteState } from '~/utils/catalog'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PageSummaryHeader from '~/components/PageSummaryHeader.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import CatalogPagination from '~/components/catalog/CatalogPagination.vue'
  import CatalogResultsPanel from '~/components/catalog/CatalogResultsPanel.vue'
  import EquipmentItemSubmissionDialog from '~/components/equipment/EquipmentItemSubmissionDialog.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const isSubmissionDialogVisible = ref(false)
  const submittedItem = ref<SubmittedCatalogItem | null>(null)
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
  const catalogItems = computed(() => itemsResponse.value.items.map((item) => {
    return {
      brand: item.brand,
      category: item.category,
      detailPath: `/catalog/${item.id}`,
      id: item.id,
      name: item.name
    }
  }))
  const isPreviousPageDisabled = computed(() => canGoPrevious.value === false || isRefreshing.value)
  const isNextPageDisabled = computed(() => canGoNext.value === false || isRefreshing.value)
  const submittedItemPath = computed(() => submittedItem.value === null ? '' : `/catalog/${submittedItem.value.id}`)

  async function handlePageChange(page: number) {
    const currentPage = routeState.value.page

    if (page === currentPage || isRefreshing.value) {
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

  function openSubmissionDialog() {
    isSubmissionDialogVisible.value = true
  }

  function handleSubmissionSubmitted(response: ItemSubmissionCreateResponse) {
    submittedItem.value = response.item
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

  .successMessage {
    margin: 0;
    padding: var(--spacing-12);
    border: 1px solid var(--color-success-subtle);
    border-radius: var(--border-radius-12);
    background: var(--color-success-subtle);
    color: var(--color-text-primary);
  }

</style>
