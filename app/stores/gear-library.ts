import { ref } from 'vue'
import { defineStore } from 'pinia'
import { clearNuxtData } from '#imports'
import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
import type { GearLibraryEntityDetail, GearLibraryItemsResponse, GearLibraryListItem } from '~/types/equipment'

interface GearLibraryItemsSnapshot {
  hasNarrowingState: boolean;
  pages: GearLibraryItemsResponse[];
}

interface CachedGearLibraryItems extends GearLibraryItemsSnapshot {
  signature: string;
}

type GearLibraryMembershipItem = Pick<GearLibraryListItem, 'id' | 'isInMyGear'>

const gearLibraryItemsAsyncDataKey = 'gear-library-items'

/** Owns shared catalog cache and user-specific membership state for this app session. */
const useGearLibraryStore = defineStore('gear-library', () => {
  const brands = ref<GearLibraryEntityDetail[]>()
  const categories = ref<GearLibraryEntityDetail[]>()
  const categoryDetails = ref<CategoryDetailResponse[]>([])
  const itemsSnapshot = ref<CachedGearLibraryItems>()
  const membershipOverrides = ref<Record<string, boolean>>({})

  function getCategoryDetail(slug: string) {
    return categoryDetails.value.find((category) => category.slug === slug)
  }

  function getItemsSnapshot(signature: string) {
    const cachedItems = itemsSnapshot.value

    if (cachedItems?.signature !== signature) {
      return
    }

    return cachedItems
  }

  function storeCategories(nextCategories: GearLibraryEntityDetail[]) {
    categories.value = nextCategories
  }

  function storeBrands(nextBrands: GearLibraryEntityDetail[]) {
    brands.value = nextBrands
  }

  function storeCategoryDetail(categoryDetail: CategoryDetailResponse) {
    const existingIndex = categoryDetails.value.findIndex(
      (category) => category.slug === categoryDetail.slug
    )

    if (existingIndex === -1) {
      categoryDetails.value.push(categoryDetail)
      return
    }

    categoryDetails.value.splice(existingIndex, 1, categoryDetail)
  }

  function storeItemsSnapshot(signature: string, snapshot: GearLibraryItemsSnapshot) {
    itemsSnapshot.value = {
      hasNarrowingState: snapshot.hasNarrowingState,
      pages: snapshot.pages,
      signature
    }
  }

  function resolveIsInMyGear(item: GearLibraryMembershipItem) {
    const membershipOverride = membershipOverrides.value[item.id]

    return membershipOverride ?? item.isInMyGear
  }

  function markItemSaved(itemId: string) {
    membershipOverrides.value[itemId] = true
  }

  function markItemRemoved(itemId: string) {
    membershipOverrides.value[itemId] = false
  }

  function resetPersonalizedState() {
    itemsSnapshot.value = undefined
    membershipOverrides.value = {}
    clearNuxtData(gearLibraryItemsAsyncDataKey)
  }

  return {
    brands,
    categories,
    categoryDetails,
    getCategoryDetail,
    getItemsSnapshot,
    itemsSnapshot,
    markItemRemoved,
    markItemSaved,
    membershipOverrides,
    resetPersonalizedState,
    resolveIsInMyGear,
    storeBrands,
    storeCategories,
    storeCategoryDetail,
    storeItemsSnapshot
  }
})

export {
  gearLibraryItemsAsyncDataKey,
  useGearLibraryStore,
  type GearLibraryItemsSnapshot
}
