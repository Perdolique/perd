<template>
  <main :class="$style.component">
    <PerdLink :class="$style.backLink" :to="backToCatalogLocation">
      <Icon name="hugeicons:arrow-left-02" aria-hidden="true" />
      Back to gear library
    </PerdLink>

    <h1 v-if="showFallbackTitle">
      Gear item
    </h1>

    <span :class="$style.visuallyHidden" role="status" aria-live="polite" aria-atomic="true">
      {{ itemLoadAnnouncement }}
    </span>

    <PageLoadingState v-if="showItemLoadingState" title="Loading equipment item" />

    <PagePlaceholder
      v-else-if="showItemLoadError"
      emoji="🧰"
      full-width
      :title="itemLoadErrorTitle"
    >
      {{ itemLoadErrorMessage }}

      <template v-if="canRetryItemLoad" #actions>
        <PerdButton :loading="isRetryingItem" variant="secondary" @click="handleRetryItem">
          Retry
        </PerdButton>
      </template>
    </PagePlaceholder>

    <article v-else-if="itemResponse" :class="$style.item">
      <div :class="$style.intro">
        <header :class="$style.header">
          <p :class="$style.kicker">
            {{ itemResponse.brand.name }}
            <span aria-hidden="true">·</span>
            {{ itemResponse.category.name }}
          </p>

          <PerdHeading ref="itemHeading" :level="1" :class="$style.title" tabindex="-1">
            {{ itemResponse.name }}
          </PerdHeading>
        </header>

        <div :class="$style.actions">
          <GearLibraryMyGearAction
            :class="$style.myGearAction"
            :has-error="hasMyGearError"
            :is-saved="isInMyGear"
            :is-saving="isSavingMyGear"
            :item-name="itemResponse.name"
            saved-appearance="action"
            size="medium"
            variant="primary"
            @add="handleMyGearAdd"
          />

          <PerdButton
            v-if="isComparisonAddAction"
            :class="$style.comparisonAction"
            icon="hugeicons:arrow-data-transfer-horizontal"
            variant="secondary"
            @click="handleComparisonAction"
          >
            {{ comparisonActionLabel }}
          </PerdButton>
          <PerdButton
            v-else
            :class="$style.comparisonAction"
            icon="hugeicons:arrow-data-transfer-horizontal"
            :to="comparisonLocation"
            variant="secondary"
          >
            {{ comparisonActionLabel }}
          </PerdButton>

          <details
            ref="moreActions"
            :class="$style.moreActions"
            @keydown.esc.prevent.stop="handleMoreEscape"
          >
            <summary :class="$style.moreTrigger">
              <Icon name="hugeicons:more-horizontal" aria-hidden="true" />
              More
            </summary>

            <div :class="$style.moreMenu">
              <PerdLink :class="$style.moreLink" :to="photoSubmissionLocation">
                <Icon name="hugeicons:camera-01" aria-hidden="true" />
                Submit photo
              </PerdLink>

              <PerdLink
                v-if="user.isAdmin"
                :class="$style.moreLink"
                :to="imagesManagementPath"
              >
                <Icon name="hugeicons:image-02" aria-hidden="true" />
                Manage images
              </PerdLink>
            </div>
          </details>

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
        </div>
      </div>

      <div :class="$style.detailBody">
        <div :class="$style.imageFrame">
          <EquipmentItemImage
            :class="$style.image"
            :alt="itemResponse.name"
            :cloudflare-image-id="itemResponse.cloudflareImageId"
            fit="inside"
            :height="660"
            loading="eager"
            preload
            sizes="sm:100vw lg:440px"
            :width="880"
          />
        </div>

        <section :class="$style.specifications" :aria-labelledby="specificationsHeadingId">
          <PerdHeading :id="specificationsHeadingId" :level="2">
            Characteristics
          </PerdHeading>

          <dl v-if="hasSpecifications" :class="$style.specificationList">
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
      </div>
    </article>
  </main>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useHead, useRoute, useUserStore } from '#imports'
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
  const moreActions = useTemplateRef('moreActions')
  const itemHeading = useTemplateRef('itemHeading')
  const specificationsHeadingId = useId()
  const isRetryingItem = ref(false)

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
  } = useFetch(`/api/equipment/items/${itemId}`, {
    lazy: true
  })

  const catalogRouteState = computed(() => getGearLibraryRouteState(route.query))
  const catalogQuery = computed(() => buildGearLibraryRouteQuery(catalogRouteState.value))

  const photoSubmissionLocation = computed(() => {
    return {
      path: photoSubmissionPath,
      query: catalogQuery.value
    }
  })

  const backToCatalogLocation = computed(() => {
    return {
      path: appRoutes.gearLibrary,
      query: catalogQuery.value
    }
  })

  const isItemLoading = computed(() => itemStatus.value === 'idle' || itemStatus.value === 'pending')
  const showItemLoadingState = computed(() => isItemLoading.value && isRetryingItem.value === false)
  const showFallbackTitle = computed(() => itemResponse.value === null || itemResponse.value === undefined)

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
  const canRetryItemLoad = computed(() => isItemNotFound.value === false)
  const showItemLoadError = computed(() => hasItemLoadError.value || isRetryingItem.value)
  const itemLoadErrorTitle = computed(() => isItemNotFound.value ? 'Item unavailable.' : 'Could not load item.')

  const itemLoadErrorMessage = computed(() => isItemNotFound.value
    ? 'This item is not available in the gear library.'
    : 'The equipment item could not be loaded. Try again.')

  const isInMyGear = computed(() => {
    const item = itemResponse.value

    return item === null || item === undefined
      ? false
      : gearLibraryStore.resolveIsInMyGear(item)
  })

  const isSavingMyGear = computed(() => myGear.savingItemIds.value.includes(itemId))
  const hasMyGearError = computed(() => myGear.failedItemIds.value.includes(itemId))

  const specificationRows = computed<SpecificationRow[]>(() => itemResponse.value?.properties.map((property) => {
    let value = String(property.value ?? 'Not set')

    if (property.value !== null) {
      if (property.dataType === 'boolean') {
        value = property.value ? 'Yes' : 'No'
      } else if (property.dataType === 'enum') {
        value = property.enumOptionName ?? value
      } else if (property.dataType === 'number' && property.unit) {
        value = `${property.value} ${property.unit}`
      }
    }

    return {
      name: property.name,
      slug: property.slug,
      value
    }
  }) ?? [])

  const hasSpecifications = computed(() => specificationRows.value.length > 0)

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

  const isComparisonAddAction = computed(() => comparisonAction.value?.isAlreadySelected === false
    && isComparisonLimitReached.value === false)

  const comparisonLocation = computed(() => {
    const nextState = comparisonAction.value?.nextState ?? catalogRouteState.value
    const query = buildGearLibraryRouteQuery(nextState)

    return {
      path: appRoutes.gearLibrary,
      query
    }
  })

  const itemLoadAnnouncement = computed(() => {
    if (isRetryingItem.value) {
      return 'Retrying equipment item.'
    }

    if (showItemLoadingState.value) {
      return 'Loading equipment item.'
    }

    return hasItemLoadError.value ? `${itemLoadErrorTitle.value} ${itemLoadErrorMessage.value}` : ''
  })

  const pageTitle = computed(() => {
    if (showItemLoadingState.value || isRetryingItem.value) {
      return 'Loading equipment item | Perd'
    }

    const item = itemResponse.value

    return item === null || item === undefined
      ? `${itemLoadErrorTitle.value} | Perd`
      : `${item.name} — ${item.brand.name} | Perd`
  })

  useHead({ title: pageTitle })

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

    const query = buildGearLibraryRouteQuery(action.nextState)

    await navigateTo({
      path: appRoutes.gearLibrary,
      query
    })
  }

  async function handleRetryItem(event: MouseEvent) {
    if (isRetryingItem.value) {
      return
    }

    const retryButton = event.currentTarget

    isRetryingItem.value = true

    try {
      await refreshItem()
    } finally {
      const shouldFocusItem = globalThis.document.activeElement === retryButton

      isRetryingItem.value = false

      if (shouldFocusItem && itemResponse.value !== null && itemResponse.value !== undefined) {
        await nextTick()

        if (globalThis.document.activeElement === globalThis.document.body) {
          itemHeading.value?.$el?.focus()
        }
      }
    }
  }

  function handleMoreEscape() {
    const details = moreActions.value

    if (details === null) {
      return
    }

    details.open = false

    details.querySelector('summary')?.focus()
  }
</script>

<style module>
  .component {
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

  .item {
    display: grid;
    gap: var(--spacing-24);
    min-inline-size: 0;
  }

  .intro {
    display: grid;
    gap: var(--spacing-20);
    min-inline-size: 0;

    @container (width >= 60rem) {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      gap: var(--spacing-24);
    }
  }

  .header {
    display: grid;
    gap: var(--spacing-8);
    min-inline-size: 0;
  }

  .kicker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .title {
    overflow-wrap: anywhere;
  }

  .actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--spacing-12);
    align-items: start;
    min-inline-size: 0;

    @container (width >= 35rem) {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
    }

    @container (width >= 60rem) {
      justify-content: flex-end;
    }
  }

  .myGearAction {
    grid-column: 1 / -1;
  }

  .comparisonAction {
    grid-column: 1;
    white-space: normal;
  }

  .moreActions {
    grid-column: 2;
    position: relative;
  }

  .moreTrigger {
    min-block-size: var(--layout-button-height-medium);
    min-inline-size: 7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-8);
    padding-inline: var(--spacing-20);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--layout-button-radius);
    background-color: var(--color-background-elevated);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;

    &:hover,
    .moreActions[open] & {
      background-color: var(--color-accent-subtle-hover);
    }
  }

  .moreMenu {
    position: absolute;
    z-index: 2;
    inset-block-start: calc(100% + var(--spacing-8));
    inset-inline-end: 0;
    inline-size: max-content;
    min-inline-size: 100%;
    max-inline-size: min(18rem, calc(100vw - 2rem));
    display: grid;
    gap: var(--spacing-4);
    padding: var(--spacing-8);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-14);
    background-color: var(--color-background-elevated);
    box-shadow: var(--shadow-medium);
  }

  .moreLink {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    min-block-size: var(--layout-touch-target);
    padding-inline: var(--spacing-12);
    border-radius: var(--border-radius-10);
    color: var(--color-text-primary);
    white-space: nowrap;

    &:hover,
    &:focus-visible {
      background-color: var(--color-accent-subtle);
    }
  }

  .comparisonHint {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);

    @container (width >= 35rem) {
      flex-basis: 100%;
      text-align: end;
    }
  }

  .detailBody {
    display: grid;
    grid-template-areas:
      'image'
      'specifications';
    gap: var(--spacing-24);
    min-inline-size: 0;

    @container (width >= 46rem) {
      grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
      grid-template-areas: 'specifications image';
      align-items: start;
      gap: var(--spacing-32);
    }
  }

  .imageFrame {
    grid-area: image;
    overflow: hidden;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
  }

  .image {
    inline-size: 100%;
    block-size: clamp(14rem, 30cqi, 19rem);
    object-fit: contain;
  }

  .specifications {
    grid-area: specifications;
    display: grid;
    gap: var(--spacing-16);
    min-inline-size: 0;
  }

  .specificationList {
    border-block-start: 1px solid var(--color-border-subtle);
  }

  .specificationRow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--spacing-16);
    padding-block: var(--spacing-12);
    border-block-end: 1px solid var(--color-border-subtle);
  }

  .specificationName {
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  .specificationValue {
    font-weight: var(--font-weight-semibold);
    overflow-wrap: anywhere;
  }

  .emptySpecifications {
    color: var(--color-text-secondary);
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
