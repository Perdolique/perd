<template>
  <PageContent :page-title="pageTitle">
    <template #actions>
      <PerdLink to="/catalog">
        Back to catalog
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PerdCard v-if="isInitialLoading" :class="$style.stateCard">
        <div :class="$style.stateBody">
          <FidgetSpinner :class="$style.spinner" />

          <PerdHeading :level="2">
            Loading item
          </PerdHeading>

          <p :class="$style.stateText">
            We are loading this catalog item right now.
          </p>
        </div>
      </PerdCard>

      <PagePlaceholder v-else-if="hasItemError" emoji="🧭" title="This item is temporarily unavailable.">
        We could not load this catalog item right now. Try this request again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.content">
        <div :class="$style.topGrid">
          <div :class="$style.mainColumn">
            <PerdCard :class="$style.mediaCard">
              <span :class="$style.mediaBadge">
                {{ itemResponse.category.name }}
              </span>

              <span :class="$style.mediaIcon" aria-hidden="true">
                <Icon name="tabler:backpack" />
              </span>
            </PerdCard>

            <PerdCard :class="$style.summaryCard">
              <div :class="$style.summaryHeader">
                <p :class="$style.summaryEyebrow">
                  {{ itemResponse.brand.name }}
                </p>

                <span :class="statusBadgeClass">
                  {{ statusText }}
                </span>
              </div>

              <p :class="$style.summaryText">
                {{ itemResponse.category.name }} gear entry ready for inventory tracking and future packing workflows.
              </p>

              <dl :class="$style.metadataList">
                <div :class="$style.metadataItem">
                  <dt :class="$style.metadataLabel">
                    Brand
                  </dt>

                  <dd :class="$style.metadataValue">
                    {{ itemResponse.brand.name }}
                  </dd>
                </div>

                <div :class="$style.metadataItem">
                  <dt :class="$style.metadataLabel">
                    Category
                  </dt>

                  <dd :class="$style.metadataValue">
                    {{ itemResponse.category.name }}
                  </dd>
                </div>

                <div :class="$style.metadataItem">
                  <dt :class="$style.metadataLabel">
                    Status
                  </dt>

                  <dd :class="$style.metadataValue">
                    {{ statusText }}
                  </dd>
                </div>
              </dl>
            </PerdCard>
          </div>

          <PerdCard :class="$style.ownershipCard">
            <div :class="$style.ownershipHeader">
              <IconTitle icon="tabler:backpack" :level="2">
                Ownership
              </IconTitle>

              <p :class="ownershipBadgeClass" role="status">
                <Icon
                  :name="ownershipStateIcon"
                  :class="$style.ownershipBadgeIcon"
                  aria-hidden="true"
                />

                <span>{{ ownershipStateText }}</span>
              </p>
            </div>

            <p :class="$style.ownershipText">
              {{ ownershipDescription }}
            </p>

            <div :class="$style.ownershipActions">
              <PerdButton
                :variant="ownershipActionVariant"
                :loading="isOwnershipActionLoading"
                :disabled="isOwnershipActionDisabled"
                :icon="ownershipActionIcon"
                @click="handleOwnershipAction"
              >
                {{ ownershipActionText }}
              </PerdButton>

              <PerdLink to="/inventory">
                View inventory
              </PerdLink>
            </div>

            <p v-if="ownershipErrorMessage" :class="$style.errorMessage" role="status">
              {{ ownershipErrorMessage }}
            </p>

            <p v-else-if="hasInventoryError" :class="$style.inlineMessage" role="status">
              We could not confirm your inventory state right now. Reload this page to try again.
            </p>
          </PerdCard>
        </div>

        <PerdCard :class="$style.propertiesCard">
          <div :class="$style.sectionHeader">
            <IconTitle icon="tabler:list-details" :level="2">
              Properties
            </IconTitle>
          </div>

          <PagePlaceholder v-if="hasNoProperties" emoji="🧰" title="No properties yet.">
            This item does not have any normalized property values yet.
          </PagePlaceholder>

          <dl v-else :class="$style.propertiesList">
            <div
              v-for="property in displayProperties"
              :key="property.slug"
              :class="$style.propertyItem"
            >
              <dt :class="$style.propertyLabel">
                {{ property.name }}
              </dt>

              <dd :class="$style.propertyValue">
                {{ property.displayValue }}
              </dd>
            </div>
          </dl>
        </PerdCard>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref, useCssModule } from 'vue'
  import { $fetch } from 'ofetch'
  import { definePageMeta, useFetch, useRoute } from '#imports'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import IconTitle from '~/components/IconTitle.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  interface ItemProperty {
    dataType: string;
    name: string;
    slug: string;
    unit: string | null;
    value: string | null;
  }

  interface ItemBrand {
    id: number;
    name: string;
    slug: string;
  }

  interface ItemCategory {
    id: number;
    name: string;
    slug: string;
  }

  interface ItemDetailResponse {
    brand: ItemBrand;
    category: ItemCategory;
    createdAt: string;
    id: string;
    name: string;
    properties: ItemProperty[];
    status: string;
  }

  interface InventoryItemBrand {
    name: string;
    slug: string;
  }

  interface InventoryItemCategory {
    name: string;
    slug: string;
  }

  interface InventoryItem {
    brand: InventoryItemBrand;
    category: InventoryItemCategory;
    id: string;
    name: string;
  }

  interface InventoryRecord {
    createdAt: string;
    id: string;
    item: InventoryItem;
  }

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const styles = useCssModule()
  const itemId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id

  const ownershipErrorMessage = ref<string | null>(null)
  const isOwnershipPending = ref(false)

  const {
    data: itemResponse,
    error: itemError,
    refresh: refreshItem,
    status: itemStatus
  } = await useFetch<ItemDetailResponse>(`/api/equipment/items/${itemId}`, {
    default: () => {
      return {
        brand: {
          id: 0,
          name: '',
          slug: ''
        },

        category: {
          id: 0,
          name: '',
          slug: ''
        },

        createdAt: '',
        id: '',
        name: '',
        properties: [],
        status: ''
      }
    }
  })

  const {
    data: inventoryResponse,
    error: inventoryError,
    refresh: refreshInventory,
    status: inventoryStatus
  } = await useFetch<InventoryRecord[]>('/api/user/equipment', {
    default: () => []
  })

  const hasItemError = computed(() => itemError.value !== undefined && itemError.value !== null)
  const isItemLoading = computed(() => itemStatus.value === 'pending')
  const isInventoryLoading = computed(() => inventoryStatus.value === 'pending')
  const hasInventoryError = computed(() => inventoryError.value !== undefined && inventoryError.value !== null)
  const isInitialLoading = computed(() => isItemLoading.value)

  function formatStatus(status: string) {
    if (status === '') {
      return 'Unknown'
    }

    return `${status.slice(0, 1).toUpperCase()}${status.slice(1)}`
  }

  function formatPropertyValue(property: ItemProperty) {
    if (property.value === null) {
      return 'Not set'
    }

    if (property.dataType === 'boolean') {
      return property.value === 'true' ? 'Yes' : 'No'
    }

    if (property.unit !== null && property.unit !== '') {
      return `${property.value} ${property.unit}`
    }

    return property.value
  }

  const pageTitle = computed(() => itemResponse.value.name === '' ? 'Catalog item' : itemResponse.value.name)
  const statusText = computed(() => formatStatus(itemResponse.value.status))
  const statusClass = computed(() => {
    if (itemResponse.value.status === 'approved') {
      return 'approved'
    }

    if (itemResponse.value.status === 'rejected') {
      return 'rejected'
    }

    return 'pending'
  })
  const ownedInventoryRow = computed(() => inventoryResponse.value.find((inventoryRow) => inventoryRow.item.id === itemResponse.value.id))
  const isOwned = computed(() => ownedInventoryRow.value !== undefined)
  const isOwnershipActionLoading = computed(() => isInventoryLoading.value || isOwnershipPending.value)
  const isOwnershipActionDisabled = computed(() => isOwnershipActionLoading.value || hasInventoryError.value || itemResponse.value.id === '')
  const ownershipActionText = computed(() => {
    if (isInventoryLoading.value) {
      return 'Loading inventory'
    }

    return isOwned.value ? 'Remove from inventory' : 'I have this'
  })
  const ownershipActionVariant = computed(() => isOwned.value ? 'danger' : 'primary')
  const ownershipActionIcon = computed(() => isOwned.value ? 'tabler:trash' : 'tabler:backpack')
  const ownershipStateText = computed(() => {
    if (isInventoryLoading.value) {
      return 'Checking saved gear'
    }

    if (hasInventoryError.value) {
      return 'Inventory unavailable'
    }

    return isOwned.value ? 'In your inventory' : 'Not in inventory'
  })
  const ownershipStateIcon = computed(() => {
    if (isInventoryLoading.value) {
      return 'tabler:hourglass-empty'
    }

    if (hasInventoryError.value) {
      return 'tabler:alert-circle'
    }

    return isOwned.value ? 'tabler:check' : 'tabler:circle-dashed'
  })
  const ownershipStateClass = computed(() => {
    if (isInventoryLoading.value) {
      return 'pending'
    }

    if (hasInventoryError.value) {
      return 'error'
    }

    return isOwned.value ? 'owned' : 'missing'
  })
  const ownershipDescription = computed(() => {
    if (isInventoryLoading.value) {
      return 'We are syncing your saved gear so this action stays accurate.'
    }

    if (hasInventoryError.value) {
      return 'The item loaded, but your inventory state did not. The control stays stable until that state is available again.'
    }

    return isOwned.value
      ? 'This item is already part of your saved gear. Remove it here if you no longer own it.'
      : 'Save this item to your personal inventory so it is ready for future packing workflows.'
  })
  const hasNoProperties = computed(() => itemResponse.value.properties.length === 0)
  const displayProperties = computed(() => itemResponse.value.properties.map((property) => {
    return {
      dataType: property.dataType,
      displayValue: formatPropertyValue(property),
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      value: property.value
    }
  }))
  const statusBadgeClass = computed(() => [styles.statusBadge, statusClass.value])
  const ownershipBadgeClass = computed(() => [styles.ownershipBadge, ownershipStateClass.value])

  async function handleRetry() {
    await Promise.all([
      refreshItem(),
      refreshInventory()
    ])
  }

  async function handleOwnershipAction() {
    if (isOwnershipActionDisabled.value) {
      return
    }

    ownershipErrorMessage.value = null
    isOwnershipPending.value = true
    const ownedBeforeRequest = isOwned.value
    const inventoryRowId = ownedInventoryRow.value?.id

    try {
      if (ownedBeforeRequest === false) {
        const createdInventoryRow = await $fetch<InventoryRecord>('/api/user/equipment', {
          method: 'POST',

          body: {
            itemId: itemResponse.value.id
          }
        })

        inventoryResponse.value = [
          createdInventoryRow,
          ...inventoryResponse.value.filter((inventoryRow) => inventoryRow.item.id !== createdInventoryRow.item.id)
        ]
      } else if (inventoryRowId !== undefined) {
        await $fetch(`/api/user/equipment/${inventoryRowId}`, {
          method: 'DELETE'
        })

        inventoryResponse.value = inventoryResponse.value.filter((inventoryRow) => inventoryRow.id !== inventoryRowId)
      }
    } catch {
      ownershipErrorMessage.value = ownedBeforeRequest === false
        ? 'We could not add this item to your inventory right now.'
        : 'We could not remove this item from your inventory right now.'
    } finally {
      isOwnershipPending.value = false
    }
  }
</script>

<style module>
  .component {
    display: grid;
  }

  .content {
    display: grid;
    gap: var(--spacing-24);
  }

  .topGrid {
    display: grid;
    gap: var(--spacing-24);

    @media (width >= 960px) {
      grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.95fr);
      align-items: start;
    }
  }

  .mainColumn {
    display: grid;
    gap: var(--spacing-24);
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
    color: var(--color-text-tertiary);
  }

  .mediaCard,
  .summaryCard,
  .ownershipCard,
  .propertiesCard {
    display: grid;
    gap: var(--spacing-24);
  }

  .mediaCard {
    position: relative;
    min-height: 18rem;
    overflow: hidden;
    place-items: center;
    background:
      radial-gradient(circle at top center, color-mix(in oklch, var(--color-accent-base), transparent 78%), transparent 35%),
      linear-gradient(180deg, var(--color-surface-base), var(--color-background-sunken));
  }

  .mediaBadge {
    position: absolute;
    top: var(--spacing-16);
    left: var(--spacing-16);
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    background: var(--color-surface-base);
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
  }

  .mediaIcon {
    display: grid;
    place-items: center;
    width: min(10rem, 30vw);
    height: min(10rem, 30vw);
    border-radius: 2rem;
    background: color-mix(in oklch, var(--color-surface-base), transparent 8%);
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-secondary);
    font-size: clamp(4rem, 10vw, 5.5rem);
  }

  .summaryHeader {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-12);
    align-items: center;
  }

  .summaryEyebrow,
  .summaryText,
  .ownershipText,
  .inlineMessage,
  .errorMessage {
    margin: 0;
  }

  .summaryEyebrow {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }

  .summaryText,
  .ownershipText,
  .inlineMessage {
    color: var(--color-text-tertiary);
  }

  .statusBadge {
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);

    &:global(.approved) {
      background: var(--color-success-subtle);
      color: var(--color-success);
    }

    &:global(.pending) {
      background: var(--color-warning-subtle);
      color: var(--color-warning);
    }

    &:global(.rejected) {
      background: var(--color-danger-subtle);
      color: var(--color-danger);
    }
  }

  .ownershipCard {
    background:
      linear-gradient(
        160deg,
        color-mix(in oklch, var(--color-accent-base), transparent 90%),
        color-mix(in oklch, var(--color-accent-base), transparent 95%) 45%,
        var(--color-surface-base)
      );
  }

  .ownershipHeader {
    display: grid;
    gap: var(--spacing-16);
  }

  .ownershipBadge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-8);
    width: fit-content;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);

    &:global(.owned) {
      background: var(--color-success-subtle);
      color: var(--color-success);
    }

    &:global(.missing) {
      background: var(--color-surface-subtle);
      color: var(--color-text-secondary);
      border-color: var(--color-border-subtle);
    }

    &:global(.pending) {
      background: var(--color-warning-subtle);
      color: var(--color-warning);
    }

    &:global(.error) {
      background: var(--color-danger-subtle);
      color: var(--color-danger);
    }
  }

  .ownershipBadgeIcon {
    font-size: 1rem;
  }

  .ownershipActions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-12);
    align-items: center;
  }

  .metadataList {
    display: grid;
    gap: var(--spacing-12);

    @media (width >= 640px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .metadataItem {
    display: grid;
    gap: var(--spacing-8);
    padding: var(--spacing-12);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border-subtle);
  }

  .metadataLabel,
  .propertyLabel {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .metadataValue,
  .propertyValue {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
  }

  .sectionHeader {
    display: flex;
    align-items: center;
  }

  .propertiesList {
    display: grid;
    gap: var(--spacing-12);

    @media (width >= 640px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .propertyItem {
    display: grid;
    gap: var(--spacing-8);
    padding: var(--spacing-16);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-subtle);
    border: 1px solid var(--color-border-subtle);
  }

  .errorMessage {
    color: var(--color-danger);
  }
</style>
