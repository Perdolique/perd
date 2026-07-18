import { useState } from '#imports'
import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'

import type {
  GearLibraryEntityDetail,
  GearLibraryItemsResponse
} from '~/types/equipment'

interface GearLibraryItemsSnapshot {
  hasNarrowingState: boolean;
  pages: GearLibraryItemsResponse[];
}

interface CachedGearLibraryItems extends GearLibraryItemsSnapshot {
  signature: string;
}

interface GearLibraryCacheState {
  brands?: GearLibraryEntityDetail[];
  categories?: GearLibraryEntityDetail[];
  categoryDetails: CategoryDetailResponse[];
  items?: CachedGearLibraryItems;
}

/** Keeps filter reference data and the latest continuous item-page prefix for this app session. */
function useGearLibraryCache() {
  const cache = useState<GearLibraryCacheState>('gear-library-cache', () => {
    return {
      categoryDetails: []
    }
  })

  function getCategories() {
    return cache.value.categories
  }

  function getBrands() {
    return cache.value.brands
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

  function storeBrands(brands: GearLibraryEntityDetail[]) {
    cache.value.brands = brands
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
      hasNarrowingState: snapshot.hasNarrowingState,
      pages: snapshot.pages,
      signature
    }
  }

  return {
    getBrands,
    getCategories,
    getCategoryDetail,
    getItemsSnapshot,
    storeBrands,
    storeCategories,
    storeCategoryDetail,
    storeItemsSnapshot
  }
}

export {
  useGearLibraryCache,
  type GearLibraryItemsSnapshot
}
