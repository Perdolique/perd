<template>
  <div :class="$style.component">
    <PerdLink :class="$style.backLink" :to="backToCatalogLocation">
      <Icon name="hugeicons:arrow-left-02" aria-hidden="true" />
      Back to gear library
    </PerdLink>

    <h1
      v-if="itemResponse === null || itemResponse === undefined"
      :class="$style.fallbackTitle"
    >
      Gear item
    </h1>

    <PageLoadingState v-if="isItemLoading" title="Loading equipment item" />

    <PagePlaceholder
      v-else-if="hasItemLoadError"
      emoji="🧰"
      full-width
      :title="isItemNotFound ? 'Item unavailable.' : 'Could not load item.'"
    >
      {{ isItemNotFound
        ? 'This item is not available in the gear library.'
        : 'The equipment item could not be loaded. Try again.'
      }}

      <template v-if="isItemNotFound === false" #actions>
        <PerdButton variant="secondary" @click="refreshItem">
          Retry
        </PerdButton>
      </template>
    </PagePlaceholder>

    <article v-else-if="itemResponse" :class="$style.item">
      <header :class="$style.header">
        <p :class="$style.kicker">
          {{ itemResponse.brand.name }}
          <span aria-hidden="true">·</span>
          {{ itemResponse.category.name }}
        </p>

        <PerdHeading :level="1" :class="$style.title">
          {{ itemResponse.name }}
        </PerdHeading>

        <div :class="$style.actions">
          <GearLibraryMyGearAction
            block
            :has-error="hasMyGearError"
            :is-saved="isInMyGear"
            :is-saving="isSavingMyGear"
            :item-name="itemResponse.name"
            size="medium"
            variant="primary"
            @add="handleMyGearAdd"
          />

          <PerdButton
            block
            icon="hugeicons:arrow-data-transfer-horizontal"
            variant="secondary"
            @click="handleComparisonAction"
          >
            {{ comparisonActionLabel }}
          </PerdButton>
        </div>

        <p v-if="isComparisonLimitReached" :class="$style.comparisonHint">
          You can compare up to 4 items. Remove one to add this item.
        </p>

        <span
          :class="$style.visuallyHidden"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ myGear.announcement.value }}
        </span>
      </header>

      <div :class="$style.imageFrame">
        <EquipmentItemImage
          :class="$style.image"
          :alt="itemResponse.name"
          :cloudflare-image-id="itemResponse.cloudflareImageId"
          fit="inside"
          :height="840"
          loading="eager"
          preload
          sizes="sm:100vw lg:720px"
          :width="1120"
        />
      </div>

      <section :class="$style.specifications" aria-labelledby="specifications-heading">
        <PerdHeading id="specifications-heading" :level="2">
          Characteristics
        </PerdHeading>

        <dl v-if="specificationRows.length > 0" :class="$style.specificationList">
          <div
            v-for="property in specificationRows"
            :key="property.slug"
            :class="$style.specificationRow"
          >
            <dt :class="$style.specificationName">
              {{ property.name }}
            </dt>
            <dd :class="$style.specificationValue">
              {{ property.value }}
            </dd>
          </div>
        </dl>

        <p v-else :class="$style.emptySpecifications">
          No characteristics yet.
        </p>
      </section>

      <footer :class="$style.footer">
        <PerdLink :to="photoSubmissionPath">
          Submit photo
        </PerdLink>

        <PerdLink v-if="user.isAdmin" :to="imagesManagementPath">
          Manage images
        </PerdLink>
      </footer>
    </article>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useRoute, useUserStore } from '#imports'
  import type { ItemDetailResponse } from '#server/api/equipment/items/[id].get'
  import { useGearLibraryMyGear } from '~/composables/use-gear-library-my-gear'
  import { useGearLibraryStore } from '~/stores/gear-library'

  import {
    buildGearLibraryRouteQuery,
    getGearLibraryDetailComparison,
    getGearLibraryRouteState
  } from '~/utils/gear-library'

  import { appRoutes, createGearLibraryPhotoSubmissionPath } from '~/utils/navigation'
  import EquipmentItemImage from '~/components/equipment/EquipmentItemImage.vue'
  import GearLibraryMyGearAction from '~/components/gear-library/GearLibraryMyGearAction.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'

  interface SpecificationRow {
    name: string;
    slug: string;
    value: string;
  }

  definePageMeta({ layout: 'page' })

  const route = useRoute()
  const { user } = useUserStore()
  const gearLibraryStore = useGearLibraryStore()
  const myGear = useGearLibraryMyGear()

  const itemId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id ?? ''

  const photoSubmissionPath = createGearLibraryPhotoSubmissionPath(itemId)
  const imagesManagementPath = `/admin/equipment/items/${itemId}/images`

  const {
    data: itemResponse,
    error: itemError,
    refresh: refreshItem,
    status: itemStatus
  } = useFetch<ItemDetailResponse>(`/api/equipment/items/${itemId}`, {
    lazy: true
  })

  const catalogRouteState = computed(() => getGearLibraryRouteState(route.query))

  const backToCatalogLocation = computed(() => {
    return {
      path: appRoutes.gearLibrary,
      query: buildGearLibraryRouteQuery(catalogRouteState.value)
    }
  })

  const isItemLoading = computed(() => itemStatus.value === 'idle' || itemStatus.value === 'pending')

  const hasItemLoadError = computed(() => {
    const hasError = itemError.value !== null && itemError.value !== undefined
    const hasNoItem = itemResponse.value === null || itemResponse.value === undefined

    return hasError || hasNoItem
  })

  const itemErrorStatus = computed(() => {
    const error = itemError.value

    if (error === null || error === undefined) {
      return
    }

    const statusCode = Reflect.get(error, 'statusCode')

    return typeof statusCode === 'number' ? statusCode : undefined
  })

  const isItemNotFound = computed(() => itemErrorStatus.value === 404)

  const isInMyGear = computed(() => {
    const item = itemResponse.value

    return item === null || item === undefined
      ? false
      : gearLibraryStore.resolveIsInMyGear(item)
  })

  const isSavingMyGear = computed(() => myGear.savingItemIds.value.includes(itemId))
  const hasMyGearError = computed(() => myGear.failedItemIds.value.includes(itemId))

  function formatPropertyValue(property: ItemDetailResponse['properties'][number]): string {
    if (property.value === null) {
      return 'Not set'
    }

    if (property.dataType === 'boolean') {
      return property.value ? 'Yes' : 'No'
    }

    if (property.dataType === 'enum') {
      return property.enumOptionName ?? String(property.value)
    }

    if (property.dataType === 'number' && property.unit) {
      return `${property.value} ${property.unit}`
    }

    return String(property.value)
  }

  const specificationRows = computed<SpecificationRow[]>(() => itemResponse.value?.properties.map((property) => {
    return {
      name: property.name,
      slug: property.slug,
      value: formatPropertyValue(property)
    }
  }) ?? [])

  const comparisonAction = computed(() => {
    const categorySlug = itemResponse.value?.category.slug

    return categorySlug === undefined
      ? undefined
      : getGearLibraryDetailComparison(catalogRouteState.value, itemId, categorySlug)
  })

  const isComparisonLimitReached = computed(() => comparisonAction.value?.isLimitReached ?? false)

  const comparisonActionLabel = computed(() => {
    if (comparisonAction.value?.isAlreadySelected) {
      return 'View comparison selection'
    }

    return isComparisonLimitReached.value ? 'Edit comparison' : 'Add to comparison'
  })

  function handleMyGearAdd() {
    const item = itemResponse.value

    if (item !== null && item !== undefined) {
      void myGear.addItem(item.id, item.name)
    }
  }

  async function handleComparisonAction() {
    const action = comparisonAction.value

    if (action === undefined) {
      return
    }

    await navigateTo({
      path: appRoutes.gearLibrary,
      query: buildGearLibraryRouteQuery(action.nextState)
    })
  }
</script>

<style module>
  .component {
    inline-size: min(100%, 45rem);
    margin-inline: auto;
    display: grid;
    gap: var(--spacing-24);
    container-type: inline-size;
  }

  .backLink {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: var(--spacing-8);
    min-block-size: var(--layout-touch-target);
    font-size: var(--font-size-14);
  }

  .fallbackTitle {
    margin: 0;
  }

  .item {
    display: grid;
    gap: var(--spacing-32);
    min-inline-size: 0;
  }

  .header {
    display: grid;
    gap: var(--spacing-16);
  }

  .kicker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .title {
    margin: 0;
    text-wrap: balance;
  }

  .actions {
    display: grid;
    gap: var(--spacing-12);
    align-items: start;

    @container (width >= 32rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .comparisonHint {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
  }

  .imageFrame {
    overflow: hidden;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
  }

  .image {
    display: block;
    inline-size: 100%;
    aspect-ratio: 4 / 3;
    object-fit: contain;
  }

  .specifications {
    display: grid;
    gap: var(--spacing-16);
  }

  .specificationList {
    margin: 0;
    border-block-start: 1px solid var(--color-border-subtle);
  }

  .specificationRow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--spacing-16);
    padding-block: var(--spacing-16);
    border-block-end: 1px solid var(--color-border-subtle);
  }

  .specificationName {
    color: var(--color-text-secondary);
  }

  .specificationValue {
    margin: 0;
    font-weight: var(--font-weight-semibold);
    overflow-wrap: anywhere;
  }

  .emptySpecifications {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-16);
    padding-block: var(--spacing-24);
    border-block-start: 1px solid var(--color-border-subtle);
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
</style>
