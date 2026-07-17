import { computed, watch, type ComputedRef } from 'vue'
import type { GearLibraryEntitySummary } from '~/types/equipment'
import type {
  GearLibraryDirection,
  GearLibraryOrdering,
  GearLibraryRouteState,
  GearLibrarySort
} from '~/utils/gear-library'

interface GearLibraryControlProperty {
  dataType: string;
  name: string;
  slug: string;
  unit: string | null;
}

interface GearLibraryControlCategory extends GearLibraryEntitySummary {
  properties: GearLibraryControlProperty[];
}

interface GearLibraryCategoryOption extends GearLibraryEntitySummary {
  isDisabled?: boolean;
}

interface GearLibraryOrderingOption extends GearLibraryOrdering {
  isDisabled?: boolean;
  label: string;
  value: string;
}

type RequestStatus = 'error' | 'idle' | 'pending' | 'success'

interface UseGearLibraryControlsOptions {
  categories: () => GearLibraryEntitySummary[];
  categoriesStatus: () => RequestStatus;
  categoryDetail: () => GearLibraryControlCategory | null;
  categoryDetailStatus: () => RequestStatus;
  handleCategoryChange: (value: string, replace?: boolean) => Promise<void>;
  handleOrderingChange: (ordering: GearLibraryOrdering, replace?: boolean) => Promise<void>;
  routeState: ComputedRef<GearLibraryRouteState>;
  selectedCategory: ComputedRef<string | undefined>;
}

const categoryNameCollator = new Intl.Collator('en')

function getOrderingValue(sort: GearLibrarySort, direction: GearLibraryDirection) {
  return `${sort}:${direction}`
}

/** Owns metadata-driven catalog controls and canonicalization after successful metadata loads. */
function useGearLibraryControls(options: UseGearLibraryControlsOptions) {
  const categoryOptions = computed<GearLibraryCategoryOption[]>(() => {
    const categoryValues = options.categories()
      .map((category) => {
        return {
          name: category.name,
          slug: category.slug
        }
      })
      .toSorted((left, right) => categoryNameCollator.compare(left.name, right.name))
    const selectedCategory = options.selectedCategory.value
    const hasSelectedCategoryOption = categoryValues.some(
      (category) => category.slug === selectedCategory
    )
    const shouldShowCurrentSelection = options.categoriesStatus() === 'error'
      && selectedCategory !== undefined
      && hasSelectedCategoryOption === false

    if (shouldShowCurrentSelection === false) {
      return categoryValues
    }

    const categoryDetail = options.categoryDetail()
    const currentCategoryName = categoryDetail?.slug === selectedCategory
      ? categoryDetail.name
      : selectedCategory

    return [{
      isDisabled: true,
      name: `${currentCategoryName} (current selection)`,
      slug: selectedCategory
    }, ...categoryValues]
  })

  const orderingValue = computed(() => {
    const state = options.routeState.value

    return getOrderingValue(state.sort, state.direction)
  })

  const orderingOptions = computed<GearLibraryOrderingOption[]>(() => {
    const orderingValues: GearLibraryOrderingOption[] = [{
      direction: 'asc',
      label: 'Name: A–Z',
      sort: 'name',
      value: 'name:asc'
    }, {
      direction: 'desc',
      label: 'Name: Z–A',
      sort: 'name',
      value: 'name:desc'
    }, {
      direction: 'asc',
      label: 'Brand: A–Z',
      sort: 'brand',
      value: 'brand:asc'
    }, {
      direction: 'desc',
      label: 'Brand: Z–A',
      sort: 'brand',
      value: 'brand:desc'
    }]

    const currentCategory = options.selectedCategory.value
    const categoryDetail = options.categoryDetail()
    const detailMatchesCurrent = categoryDetail?.slug === currentCategory

    if (detailMatchesCurrent && categoryDetail !== null) {
      const numberProperties = categoryDetail.properties.filter(
        (property) => property.dataType === 'number'
      )

      for (const property of numberProperties) {
        const hasUnit = property.unit !== null && property.unit !== ''
        const propertyLabel = hasUnit ? `${property.name} (${property.unit})` : property.name
        const sort: GearLibrarySort = `property:${property.slug}`
        const ascendingValue = getOrderingValue(sort, 'asc')
        const descendingValue = getOrderingValue(sort, 'desc')

        orderingValues.push({
          direction: 'asc',
          label: `${propertyLabel}: Low to high`,
          sort,
          value: ascendingValue
        }, {
          direction: 'desc',
          label: `${propertyLabel}: High to low`,
          sort,
          value: descendingValue
        })
      }
    }

    const state = options.routeState.value
    const currentOrderingValue = getOrderingValue(state.sort, state.direction)
    const hasCurrentOrderingOption = orderingValues.some(
      (ordering) => ordering.value === currentOrderingValue
    )
    const shouldShowUnavailablePropertySort = options.categoryDetailStatus() === 'error'
      && state.sort.startsWith('property:')
      && hasCurrentOrderingOption === false

    if (shouldShowUnavailablePropertySort) {
      orderingValues.unshift({
        direction: state.direction,
        isDisabled: true,
        label: 'Current property sorting unavailable',
        sort: state.sort,
        value: currentOrderingValue
      })
    }

    return orderingValues
  })

  watch(
    [options.categoriesStatus, options.categories, () => options.selectedCategory.value],
    async ([status, categories, categorySlug]) => {
      if (status !== 'success' || categorySlug === undefined) {
        return
      }

      const hasSupportedCategory = categories.some((category) => category.slug === categorySlug)

      if (hasSupportedCategory) {
        return
      }

      await options.handleCategoryChange('', true)
    },
    {
      immediate: true
    }
  )

  watch(
    [
      options.categoryDetailStatus,
      options.categoryDetail,
      () => options.selectedCategory.value,
      () => options.routeState.value.sort
    ],
    async ([status, categoryDetail, categorySlug, sort]) => {
      const isPropertySort = sort.startsWith('property:')

      if (
        status !== 'success'
        || categoryDetail === null
        || categoryDetail.slug !== categorySlug
        || isPropertySort === false
      ) {
        return
      }

      const propertySlug = sort.slice('property:'.length)
      const hasSupportedPropertySort = categoryDetail.properties.some((property) => (
        property.dataType === 'number' && property.slug === propertySlug
      ))

      if (hasSupportedPropertySort) {
        return
      }

      const defaultOrdering: GearLibraryOrdering = {
        direction: 'asc',
        sort: 'name'
      }

      await options.handleOrderingChange(defaultOrdering, true)
    },
    {
      immediate: true
    }
  )

  return {
    categoryOptions,
    orderingOptions,
    orderingValue
  }
}

export { useGearLibraryControls }
