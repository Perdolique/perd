import { ref, shallowRef, watch, type ComputedRef } from 'vue'
import { useAsyncData, useFetch, useRequestFetch } from '#imports'
import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
import type { GearLibraryItemsApiQuery } from '~/utils/gear-library'
import { useGearLibraryCache } from '~/composables/use-gear-library-cache'

interface UseGearLibraryDataOptions {
  hasNarrowingState: ComputedRef<boolean>;
  itemsApiQuery: ComputedRef<GearLibraryItemsApiQuery>;
  itemsApiQuerySignature: ComputedRef<string>;
  selectedCategory: ComputedRef<string | undefined>;
}

/** Owns gear library requests, transport cancellation, and session-cache synchronization. */
async function useGearLibraryData(options: UseGearLibraryDataOptions) {
  const requestFetch = useRequestFetch()

  const {
    getBrands,
    getCategories,
    getCategoryDetail,
    getItemsSnapshot,
    storeBrands,
    storeCategories,
    storeCategoryDetail,
    storeItemsSnapshot
  } = useGearLibraryCache()

  function getCachedDetailForSlug(slug: string | undefined) {
    if (slug === undefined) {
      return null
    }

    return getCategoryDetail(slug) ?? null
  }

  const cachedBrands = getBrands()
  const cachedCategories = getCategories()
  const initialItemsSnapshot = getItemsSnapshot(options.itemsApiQuerySignature.value)
  const initialCategorySlug = options.selectedCategory.value
  const initialCategoryDetail: CategoryDetailResponse | null = getCachedDetailForSlug(initialCategorySlug)

  const initialItemsResponse = initialItemsSnapshot?.response ?? {
    items: [],
    limit: 20,
    page: 1,
    total: 0
  }

  const brandsRequest = useFetch('/api/equipment/brands', {
    default: () => cachedBrands ?? [],
    lazy: true
  })

  const categoriesRequest = useFetch('/api/equipment/categories', {
    default: () => cachedCategories ?? [],
    lazy: true
  })

  const itemsRequest = useFetch('/api/equipment/items', {
    default: () => initialItemsResponse,
    key: 'gear-library-items',
    lazy: true,
    query: options.itemsApiQuery,
    watch: false
  })

  const categoryDetailRequest = useAsyncData('gear-library-category-detail', async (_nuxtApp, { signal }) => {
    const categorySlug = options.selectedCategory.value

    if (categorySlug === undefined) {
      return null
    }

    const categoryDetailPath = `/api/equipment/categories/by-slug/${categorySlug}` as const
    const categoryDetail = await requestFetch(categoryDetailPath, { signal })

    return categoryDetail
  }, {
    default: () => initialCategoryDetail,
    lazy: true
  })

  const [brandsAsyncData, categoriesAsyncData, itemsAsyncData, categoryDetailAsyncData] = await Promise.all([
    brandsRequest,
    categoriesRequest,
    itemsRequest,
    categoryDetailRequest
  ])

  const {
    data: brandsResponse,
    error: brandsError,
    refresh: refreshBrands,
    status: brandsStatus
  } = brandsAsyncData

  const {
    data: categoriesResponse,
    error: categoriesError,
    refresh: refreshCategories,
    status: categoriesStatus
  } = categoriesAsyncData

  const {
    data: itemsResponse,
    error: itemsError,
    refresh: refreshItems,
    status: itemsStatus
  } = itemsAsyncData

  const {
    data: categoryDetailResponse,
    error: categoryDetailError,
    refresh: refreshCategoryDetail,
    status: categoryDetailStatus
  } = categoryDetailAsyncData

  const hasBrandsData = ref(cachedBrands !== undefined || brandsStatus.value === 'success')
  const hasCategoriesData = ref(cachedCategories !== undefined || categoriesStatus.value === 'success')

  const hasSuccessfulItemsRequest = ref(
    initialItemsSnapshot !== undefined || itemsStatus.value === 'success'
  )

  const lastSuccessfulHasNarrowingState = ref(initialItemsSnapshot?.hasNarrowingState ?? false)
  const lastSuccessfulItemsResponse = shallowRef(initialItemsSnapshot?.response ?? itemsResponse.value)
  const activeCategoryDetail = shallowRef<CategoryDetailResponse | null>(initialCategoryDetail)

  watch(options.itemsApiQuery, async () => {
    const signature = options.itemsApiQuerySignature.value
    const cachedSnapshot = getItemsSnapshot(signature)

    if (cachedSnapshot !== undefined) {
      hasSuccessfulItemsRequest.value = true
      lastSuccessfulHasNarrowingState.value = cachedSnapshot.hasNarrowingState
      lastSuccessfulItemsResponse.value = cachedSnapshot.response
    }

    await refreshItems()
  })

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
    immediate: true
  })

  watch(categoriesStatus, (status) => {
    if (status !== 'success') {
      return
    }

    hasCategoriesData.value = true
    storeCategories(categoriesResponse.value)
  }, {
    immediate: true
  })

  watch(itemsStatus, (status) => {
    if (status !== 'success') {
      return
    }

    hasSuccessfulItemsRequest.value = true
    lastSuccessfulHasNarrowingState.value = options.hasNarrowingState.value
    lastSuccessfulItemsResponse.value = itemsResponse.value

    const signature = options.itemsApiQuerySignature.value
    const snapshot = {
      hasNarrowingState: options.hasNarrowingState.value,
      response: itemsResponse.value
    }

    storeItemsSnapshot(signature, snapshot)
  }, {
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
    immediate: true
  })

  return {
    activeCategoryDetail,
    brandsError,
    brandsResponse,
    brandsStatus,
    categoriesError,
    categoriesResponse,
    categoriesStatus,
    categoryDetailError,
    categoryDetailStatus,
    hasBrandsData,
    hasCategoriesData,
    hasSuccessfulItemsRequest,
    itemsError,
    itemsStatus,
    lastSuccessfulHasNarrowingState,
    lastSuccessfulItemsResponse,
    refreshBrands,
    refreshCategories,
    refreshCategoryDetail,
    refreshItems
  }
}

export { useGearLibraryData }
