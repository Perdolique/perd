import { ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import { useAsyncData, useRequestFetch } from '#imports'
import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
import type { GearLibraryItemsApiQuery } from '~/utils/gear-library'
import { useGearLibraryCache } from '~/composables/use-gear-library-cache'
import { useGearLibraryItemsData } from '~/composables/use-gear-library-items-data'

interface UseGearLibraryDataOptions {
  desiredPageCount: Ref<number>;
  hasNarrowingState: ComputedRef<boolean>;
  itemsApiQuery: ComputedRef<GearLibraryItemsApiQuery>;
  itemsApiQuerySignature: ComputedRef<string>;
  selectedCategory: ComputedRef<string | undefined>;
}

/** Owns gear library reference-data requests alongside continuous item batches. */
async function useGearLibraryData(options: UseGearLibraryDataOptions) {
  const requestFetch = useRequestFetch()
  const {
    getBrands,
    getCategories,
    getCategoryDetail,
    storeBrands,
    storeCategories,
    storeCategoryDetail
  } = useGearLibraryCache()

  function getCachedDetailForSlug(slug: string | undefined) {
    if (slug === undefined) {
      return null
    }

    return getCategoryDetail(slug) ?? null
  }

  const cachedBrands = getBrands()
  const cachedCategories = getCategories()
  const initialCategorySlug = options.selectedCategory.value
  const initialCategoryDetail: CategoryDetailResponse | null = getCachedDetailForSlug(initialCategorySlug)
  const brandsRequest = useAsyncData('gear-library-brands', async (_nuxtApp, { signal }) => {
    const response = await requestFetch('/api/equipment/brands', {
      method: 'get',
      signal
    })

    return response
  }, {
    default: () => cachedBrands ?? [],
    lazy: true
  })
  const categoriesRequest = useAsyncData('gear-library-categories', async (_nuxtApp, { signal }) => {
    const response = await requestFetch('/api/equipment/categories', {
      method: 'get',
      signal
    })

    return response
  }, {
    default: () => cachedCategories ?? [],
    lazy: true
  })
  const categoryDetailRequest = useAsyncData('gear-library-category-detail', async (_nuxtApp, { signal }) => {
    const categorySlug = options.selectedCategory.value

    if (categorySlug === undefined) {
      return null
    }

    const categoryDetailPath = `/api/equipment/categories/by-slug/${categorySlug}` as const
    const categoryDetail = await requestFetch(categoryDetailPath, {
      method: 'get',
      signal
    })

    return categoryDetail
  }, {
    default: () => initialCategoryDetail,
    lazy: true
  })
  const itemsData = useGearLibraryItemsData(options)
  const {
    data: brandsResponse,
    error: brandsError,
    refresh: refreshBrands,
    status: brandsStatus
  } = brandsRequest
  const {
    data: categoriesResponse,
    error: categoriesError,
    refresh: refreshCategories,
    status: categoriesStatus
  } = categoriesRequest
  const {
    data: categoryDetailResponse,
    error: categoryDetailError,
    refresh: refreshCategoryDetail,
    status: categoryDetailStatus
  } = categoryDetailRequest
  const hasBrandsData = ref(cachedBrands !== undefined || brandsStatus.value === 'success')
  const hasCategoriesData = ref(cachedCategories !== undefined || categoriesStatus.value === 'success')
  const activeCategoryDetail = shallowRef<CategoryDetailResponse | null>(initialCategoryDetail)

  watch(options.selectedCategory, async (categorySlug) => {
    activeCategoryDetail.value = getCachedDetailForSlug(categorySlug)

    await refreshCategoryDetail()
  })

  watch(brandsStatus, (status) => {
    if (status !== 'success') {
      return
    }

    hasBrandsData.value = true
    storeBrands(brandsResponse.value)
  }, {
    flush: 'sync',
    immediate: true
  })

  watch(categoriesStatus, (status) => {
    if (status !== 'success') {
      return
    }

    hasCategoriesData.value = true
    storeCategories(categoriesResponse.value)
  }, {
    flush: 'sync',
    immediate: true
  })

  watch(categoryDetailStatus, (status) => {
    if (status !== 'success') {
      return
    }

    const categoryDetail = categoryDetailResponse.value

    if (categoryDetail === null || categoryDetail.slug !== options.selectedCategory.value) {
      return
    }

    activeCategoryDetail.value = categoryDetail
    storeCategoryDetail(categoryDetail)
  }, {
    flush: 'sync',
    immediate: true
  })

  await Promise.all([
    brandsRequest,
    categoriesRequest,
    categoryDetailRequest,
    itemsData.initialItemsRequest
  ])

  return {
    activeCategoryDetail,
    brandsError,
    brandsResponse,
    brandsStatus,
    canLoadMore: itemsData.canLoadMore,
    categoriesError,
    categoriesResponse,
    categoriesStatus,
    categoryDetailError,
    categoryDetailStatus,
    hasBrandsData,
    hasCategoriesData,
    hasLoadMoreError: itemsData.hasLoadMoreError,
    hasSuccessfulItemsRequest: itemsData.hasSuccessfulItemsRequest,
    isBrowsingStateReady: itemsData.isBrowsingStateReady,
    isLoadingMore: itemsData.isLoadingMore,
    itemsError: itemsData.itemsError,
    itemsStatus: itemsData.itemsStatus,
    lastSuccessfulHasNarrowingState: itemsData.lastSuccessfulHasNarrowingState,
    lastSuccessfulItemsResponse: itemsData.lastSuccessfulItemsResponse,
    loadMore: itemsData.loadMore,
    loadMoreAnnouncement: itemsData.loadMoreAnnouncement,
    refreshBrands,
    refreshCategories,
    refreshCategoryDetail,
    refreshItems: itemsData.refreshItems,
    retryLoadMore: itemsData.retryLoadMore
  }
}

export { useGearLibraryData }
