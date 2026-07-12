import { useState } from '#imports'
import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
import type {
  GearLibraryEntityDetail,
  GearLibraryItemsResponse
} from '~/types/equipment'

interface GearLibraryItemsSnapshot {
  hasNarrowingState: boolean;
  response: GearLibraryItemsResponse;
}

interface CachedGearLibraryItems extends GearLibraryItemsSnapshot {
  signature: string;
}

interface GearLibraryCacheState {
  categories?: GearLibraryEntityDetail[];
  categoryDetails: CategoryDetailResponse[];
  items?: CachedGearLibraryItems;
}

/** Keeps category data and the latest items response for this app session. */
function useGearLibraryCache() {
  const cache = useState<GearLibraryCacheState>('gear-library-cache', () => {
    return {
      categoryDetails: []
    }
  })

  function getCategories() {
    return cache.value.categories
  }

  function getCategoryDetail(slug: string) {
    return cache.value.categoryDetails.find((category) => category.slug === slug)
  }

  function getItemsSnapshot(signature: string) {
    const cachedItems = cache.value.items

    if (cachedItems?.signature !== signature) {
      return
    }

    return cachedItems
  }

  function storeCategories(categories: GearLibraryEntityDetail[]) {
    cache.value.categories = categories
  }

  function storeCategoryDetail(categoryDetail: CategoryDetailResponse) {
    const existingIndex = cache.value.categoryDetails.findIndex(
      (category) => category.slug === categoryDetail.slug
    )

    if (existingIndex === -1) {
      cache.value.categoryDetails.push(categoryDetail)
      return
    }

    cache.value.categoryDetails.splice(existingIndex, 1, categoryDetail)
  }

  function storeItemsSnapshot(signature: string, snapshot: GearLibraryItemsSnapshot) {
    cache.value.items = {
      ...snapshot,
      signature
    }
  }

  return {
    getCategories,
    getCategoryDetail,
    getItemsSnapshot,
    storeCategories,
    storeCategoryDetail,
    storeItemsSnapshot
  }
}

export {
  useGearLibraryCache,
  type GearLibraryItemsSnapshot
}
