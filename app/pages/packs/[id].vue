<template>
  <PageContent :page-title="pageTitle">
    <template #actions>
      <PerdLink to="/packs">
        Back to packs
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading pack"
      />

      <PagePlaceholder v-else-if="hasError" emoji="🧭" title="Pack unavailable.">
        Try again.

        <template #actions>
          <PerdLink to="/packs">
            Back to packs
          </PerdLink>

          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.content">
        <PerdCard :class="$style.overviewCard">
          <div :class="$style.overviewHeader">
            <div :class="$style.titleRow">
              <span :class="$style.icon" aria-hidden="true">
                <Icon name="tabler:route" />
              </span>

              <div :class="$style.titleBlock">
                <div :class="$style.label">
                  Pack
                </div>

                <h2 :class="$style.title">
                  {{ packingList.name }}
                </h2>
              </div>
            </div>

            <div :class="$style.overviewAside">
              <div :class="$style.modeToggle" role="group" aria-label="Pack detail mode">
                <button
                  type="button"
                  :class="[$style.modeButton, {
                    active: isPlanningMode
                  }]"
                  :aria-pressed="isPlanningMode"
                  @click="setDetailMode('planning')"
                >
                  <Icon name="tabler:edit-circle" aria-hidden="true" />
                  Planning
                </button>

                <button
                  type="button"
                  :class="[$style.modeButton, {
                    active: isChecklistMode
                  }]"
                  :aria-pressed="isChecklistMode"
                  @click="setDetailMode('checklist')"
                >
                  <Icon name="tabler:checkbox" aria-hidden="true" />
                  Checklist
                </button>
              </div>

              <dl :class="$style.metaGrid">
                <div :class="$style.metaItem">
                  <dt :class="$style.metaLabel">
                    Items
                  </dt>

                  <dd :class="$style.metaValue">
                    {{ entryCount }}
                  </dd>
                </div>

                <div :class="$style.metaItem">
                  <dt :class="$style.metaLabel">
                    Packed
                  </dt>

                  <dd :class="$style.metaValue">
                    {{ packedCount }}
                  </dd>
                </div>

                <div :class="$style.metaItem">
                  <dt :class="$style.metaLabel">
                    Updated
                  </dt>

                  <dd :class="$style.metaValue">
                    <time :datetime="packingList.updatedAt">{{ formattedUpdatedAt }}</time>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </PerdCard>

        <PerdCard :class="$style.checklistCard">
          <div :class="$style.checklistHeader">
            <div :class="$style.checklistTitleBlock">
              <IconTitle :icon="detailModeIcon" :level="2">
                {{ detailModeTitle }}
              </IconTitle>

              <p :class="$style.checklistSummary">
                {{ detailModeSummary }}
              </p>
            </div>
          </div>

          <div v-if="isPlanningMode" :class="$style.planningPanel">
            <form :class="$style.entryForm" @submit.prevent="handleCreateCustomEntry">
              <div :class="$style.entryField">
                <label :class="$style.inputLabel" for="new-packing-list-entry-name">
                  Custom item
                </label>

                <div :class="$style.inputShell">
                  <Icon name="tabler:plus" :class="$style.inputIcon" aria-hidden="true" />

                  <input
                    id="new-packing-list-entry-name"
                    v-model="newEntryName"
                    :disabled="isAnyEntryActionPending"
                    :aria-describedby="createEntryDescribedBy"
                    :class="$style.input"
                    name="customName"
                    autocomplete="off"
                    placeholder="Rain jacket"
                  >
                </div>
              </div>

              <PerdButton
                type="submit"
                icon="tabler:plus"
                :loading="isCreatingCustomEntry"
                :disabled="isCreateCustomEntryDisabled"
              >
                Add custom item
              </PerdButton>
            </form>

            <div :class="$style.inventorySection">
              <div :class="$style.inventoryHeader">
                <div>
                  <p :class="$style.sectionEyebrow">
                    Saved gear
                  </p>

                  <h3 :class="$style.sectionTitle">
                    Add from inventory
                  </h3>
                </div>
              </div>

              <p v-if="isInventoryLoading" :class="$style.helperMessage" role="status">
                Loading gear.
              </p>

              <p v-else-if="hasInventoryError" :class="$style.errorMessage" role="status">
                Could not load gear.
              </p>

              <p v-else-if="isInventoryEmpty" :class="$style.helperMessage">
                Save gear in your inventory first, then add it here.
              </p>

              <p v-else-if="isAvailableInventoryEmpty" :class="$style.helperMessage">
                Every saved item is already in this pack.
              </p>

              <ul v-else :class="$style.inventoryPickerList">
                <li
                  v-for="inventoryRow in availableInventoryRows"
                  :key="inventoryRow.id"
                  :class="$style.inventoryPickerItem"
                >
                  <div :class="$style.inventoryPickerText">
                    <span :class="$style.inventoryPickerName">
                      {{ inventoryRow.item.name }}
                    </span>

                    <span :class="$style.inventoryPickerMeta">
                      {{ inventoryRow.item.brand.name }} · {{ inventoryRow.item.category.name }}
                    </span>
                  </div>

                  <PerdButton
                    size="small"
                    variant="secondary"
                    icon="tabler:plus"
                    :loading="creatingInventoryId === inventoryRow.id"
                    :disabled="isAddInventoryDisabled(inventoryRow.id)"
                    @click="handleCreateInventoryEntry(inventoryRow.id)"
                  >
                    Add
                  </PerdButton>
                </li>
              </ul>
            </div>
          </div>

          <p
            v-if="isCreateEntryErrorVisible"
            id="packing-list-entry-create-error"
            :class="$style.errorMessage"
            role="status"
          >
            {{ createEntryErrorMessage }}
          </p>

          <div v-if="isEntryListEmpty" :class="$style.emptyChecklist">
            <span :class="$style.emptyIcon" aria-hidden="true">
              🎒
            </span>

            <p :class="$style.emptyCopy">
              {{ emptyStateCopy }}
            </p>
          </div>

          <ul v-else :class="$style.entryList">
            <li
              v-for="entry in entryViews"
              :key="entry.id"
              :class="[$style.entryItem, entry.stateClass]"
            >
              <template v-if="isChecklistMode">
                <label :class="$style.entryToggle">
                  <input
                    type="checkbox"
                    :class="$style.entryCheckbox"
                    :checked="entry.isPacked"
                    :disabled="entry.isDisabled"
                    :aria-label="entry.toggleLabel"
                    @change="handleToggleEntry(entry)"
                  >

                  <span :class="$style.entryText">
                    <span :class="$style.entryName">
                      {{ entry.displayName }}
                    </span>

                    <span :class="$style.entryMeta">
                      {{ entry.detailText }}
                    </span>

                    <span :class="$style.entryState">
                      {{ entry.stateText }}
                    </span>
                  </span>
                </label>
              </template>

              <template v-else>
                <div :class="$style.entrySummary">
                  <span :class="$style.entryName">
                    {{ entry.displayName }}
                  </span>

                  <span :class="$style.entryMeta">
                    {{ entry.detailText }}
                  </span>

                  <span :class="$style.entryState">
                    {{ entry.stateText }}
                  </span>
                </div>
              </template>

              <PerdButton
                variant="danger"
                size="small"
                icon="tabler:trash"
                :loading="entry.isLoading"
                :disabled="entry.isDisabled"
                @click="handleDeleteEntry(entry)"
              >
                Remove
              </PerdButton>
            </li>
          </ul>

          <p v-if="isEntryMutationErrorVisible" :class="$style.errorMessage" role="status">
            {{ entryMutationErrorMessage }}
          </p>
        </PerdCard>

        <PerdCard :class="$style.dangerCard">
          <div :class="$style.dangerContent">
            <IconTitle icon="tabler:alert-triangle" :level="2">
              Danger Zone
            </IconTitle>

            <p :class="$style.dangerCopy">
              Delete this pack when it is no longer useful. This action cannot be undone.
            </p>

            <PerdButton
              variant="danger"
              icon="tabler:trash"
              @click="showDeleteDialog"
            >
              Delete pack
            </PerdButton>
          </div>
        </PerdCard>
      </div>
    </div>

    <ConfirmationDialog
      v-model="isDeleteDialogVisible"
      :header-text="deleteDialogHeaderText"
      confirm-button-text="Delete pack"
      confirm-variant="danger"
      :confirm-loading="isDeleting"
      :confirm-disabled="isDeleting"
      :close-on-confirm="false"
      @confirm="handleDeletePack"
    >
      <div :class="$style.confirmationBody">
        <p :class="$style.confirmationCopy">
          This will permanently delete the pack and return you to the packs list.
        </p>

        <p v-if="deleteErrorMessage" :class="$style.errorMessage" role="status">
          {{ deleteErrorMessage }}
        </p>
      </div>
    </ConfirmationDialog>
  </PageContent>
</template>

<script lang="ts" setup>
  // oxlint-disable max-lines
  import { computed, ref } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useRequestFetch, useRoute } from '#imports'
  import type { InventoryRecord } from '~/types/equipment'
  import type { PackingListDetail, PackingListEntry } from '~/types/packing'
  import {
    getEntryDetailText,
    getEntryDisplayName,
    getErrorStatusCode,
    normalizeDateString,
    normalizePackingListEntry
  } from '~/utils/packing-detail'
  import { packingListDateFormatter } from '~/utils/packing'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import IconTitle from '~/components/IconTitle.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  interface PackingListEntryView extends PackingListEntry {
    detailText: string;
    displayName: string;
    isDisabled: boolean;
    isLoading: boolean;
    stateClass: 'packed' | 'unpacked';
    stateText: string;
    toggleLabel: string;
  }

  type PackDetailMode = 'planning' | 'checklist'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const packingListId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id

  const requestFetch = useRequestFetch()
  const detailMode = ref<PackDetailMode>('planning')
  const isDeleteDialogVisible = ref(false)
  const isDeleting = ref(false)
  const deleteErrorMessage = ref<string | null>(null)
  const newEntryName = ref('')
  const createEntryErrorMessage = ref<string | null>(null)
  const entryMutationErrorMessage = ref<string | null>(null)
  const isCreatingCustomEntry = ref(false)
  const creatingInventoryId = ref<string | null>(null)
  const mutatingEntryId = ref<string | null>(null)

  const {
    data: packingList,
    error: packingListError,
    refresh: refreshPackingList,
    status: packingListStatus
  } = await useFetch(`/api/user/packing-lists/${packingListId}`, {
    default: (): PackingListDetail => {
      return {
        createdAt: '',
        entries: [],
        id: '',
        name: '',
        updatedAt: ''
      }
    },

    lazy: true
  })

  const {
    data: inventoryResponse,
    error: inventoryError,
    status: inventoryStatus
  } = await useFetch('/api/user/equipment', {
    default: (): InventoryRecord[] => []
  })

  function setDetailMode(mode: PackDetailMode) {
    detailMode.value = mode
  }

  function updatePackingListState(update: Partial<PackingListDetail>) {
    packingList.value = {
      createdAt: update.createdAt ?? packingList.value.createdAt,
      entries: update.entries ?? packingList.value.entries,
      id: update.id ?? packingList.value.id,
      name: update.name ?? packingList.value.name,
      updatedAt: update.updatedAt ?? packingList.value.updatedAt
    }
  }

  function resetEntryMessages() {
    createEntryErrorMessage.value = null
    entryMutationErrorMessage.value = null
  }

  function applyCreatedEntry(entry: PackingListEntry, packingListUpdatedAt: Date | string) {
    const normalizedEntry = normalizePackingListEntry(entry)
    const normalizedUpdatedAt = normalizeDateString(packingListUpdatedAt)

    updatePackingListState({
      entries: [
        ...packingList.value.entries,
        normalizedEntry
      ],
      updatedAt: normalizedUpdatedAt
    })
  }

  const hasError = computed(() => packingListError.value !== undefined && packingListError.value !== null)
  const isInitialLoading = computed(() => packingListStatus.value === 'pending')
  const hasInventoryError = computed(() => inventoryError.value !== undefined && inventoryError.value !== null)
  const isInventoryLoading = computed(() => inventoryStatus.value === 'pending')
  const isPlanningMode = computed(() => detailMode.value === 'planning')
  const isChecklistMode = computed(() => detailMode.value === 'checklist')
  const pageTitle = computed(() => hasError.value ? 'Pack' : packingList.value.name)
  const deleteDialogHeaderText = computed(() => `Delete "${packingList.value.name}"?`)
  const entryCount = computed(() => packingList.value.entries.length)
  const packedCount = computed(() => packingList.value.entries.filter((entry) => entry.isPacked).length)
  const isEntryListEmpty = computed(() => entryCount.value === 0)
  const isInventoryEmpty = computed(() => inventoryResponse.value.length === 0)
  const isEntryMutationPending = computed(() => mutatingEntryId.value !== null)
  const isInventoryCreatePending = computed(() => creatingInventoryId.value !== null)
  const isEntryCreatePending = computed(() => isCreatingCustomEntry.value || isInventoryCreatePending.value)
  const isAnyEntryActionPending = computed(() => isEntryCreatePending.value || isEntryMutationPending.value)
  const isCreateEntryErrorVisible = computed(() => createEntryErrorMessage.value !== null)
  const isEntryMutationErrorVisible = computed(() => entryMutationErrorMessage.value !== null)
  const inventoryEntryIds = computed(() => new Set(
    packingList.value.entries
      .map((entry) => entry.inventory?.inventoryId)
      .filter((inventoryId): inventoryId is string => inventoryId !== undefined)
  ))
  const availableInventoryRows = computed(() => inventoryResponse.value.filter(
    (inventoryRow) => inventoryEntryIds.value.has(inventoryRow.id) === false
  ))
  const isAvailableInventoryEmpty = computed(() => availableInventoryRows.value.length === 0)
  const isCreateCustomEntryDisabled = computed(() => {
    const trimmedName = newEntryName.value.trim()

    return trimmedName === '' || isAnyEntryActionPending.value
  })
  const createEntryDescribedBy = computed(() => {
    if (isCreateEntryErrorVisible.value === false) {
      return
    }

    return 'packing-list-entry-create-error'
  })
  const entryCountText = computed(() => {
    if (entryCount.value === 1) {
      return '1 item'
    }

    return `${entryCount.value} items`
  })
  const packedCountText = computed(() => `${packedCount.value} of ${entryCount.value} packed`)
  const formattedUpdatedAt = computed(() => {
    if (packingList.value.updatedAt === '') {
      return ''
    }

    return packingListDateFormatter.format(new Date(packingList.value.updatedAt))
  })
  const detailModeTitle = computed(() => isPlanningMode.value ? 'Planning' : 'Checklist')
  const detailModeIcon = computed(() => isPlanningMode.value ? 'tabler:edit-circle' : 'tabler:checkbox')
  const detailModeSummary = computed(() => isPlanningMode.value ? entryCountText.value : packedCountText.value)
  const emptyStateCopy = computed(() => {
    if (isPlanningMode.value) {
      return 'Add custom items or pull from saved gear while you build this pack.'
    }

    return 'Switch to planning mode to add items before packing.'
  })
  const entryViews = computed<PackingListEntryView[]>(() => packingList.value.entries.map((entry) => {
    const isLoading = mutatingEntryId.value === entry.id
    const isDisabled = isAnyEntryActionPending.value
    const displayName = getEntryDisplayName(entry)
    const detailText = getEntryDetailText(entry)
    const stateClass = entry.isPacked ? 'packed' : 'unpacked'
    const stateText = entry.isPacked ? 'Packed' : 'Not packed'
    const toggleAction = entry.isPacked ? 'Mark unpacked' : 'Mark packed'
    const toggleLabel = `${toggleAction}: ${displayName}`

    return {
      createdAt: entry.createdAt,
      customName: entry.customName,
      detailText,
      displayName,
      id: entry.id,
      inventory: entry.inventory,
      isDisabled,
      isLoading,
      isPacked: entry.isPacked,
      source: entry.source,
      stateClass,
      stateText,
      toggleLabel,
      updatedAt: entry.updatedAt
    }
  }))

  function isAddInventoryDisabled(inventoryId: string) {
    const isAlreadyAdded = inventoryEntryIds.value.has(inventoryId)
    const isLoading = creatingInventoryId.value === inventoryId

    return isAlreadyAdded || isLoading || isAnyEntryActionPending.value
  }

  async function handleRetry() {
    await refreshPackingList()
  }

  async function handleCreateCustomEntry() {
    if (isCreateCustomEntryDisabled.value) {
      return
    }

    resetEntryMessages()
    isCreatingCustomEntry.value = true

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries`, {
        method: 'POST',

        body: {
          customName: newEntryName.value
        }
      })

      applyCreatedEntry(response.entry, response.packingListUpdatedAt)
      newEntryName.value = ''
    } catch {
      createEntryErrorMessage.value = 'Could not add item.'
    } finally {
      isCreatingCustomEntry.value = false
    }
  }

  async function handleCreateInventoryEntry(inventoryId: string) {
    if (isAddInventoryDisabled(inventoryId)) {
      return
    }

    resetEntryMessages()
    creatingInventoryId.value = inventoryId

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries`, {
        method: 'POST',

        body: {
          inventoryId
        }
      })

      applyCreatedEntry(response.entry, response.packingListUpdatedAt)
    } catch (error) {
      const statusCode = getErrorStatusCode(error)

      createEntryErrorMessage.value = statusCode === 409
        ? 'This saved item is already in the pack.'
        : 'Could not add saved item.'
    } finally {
      creatingInventoryId.value = null
    }
  }

  async function handleToggleEntry(entry: PackingListEntryView) {
    if (entry.isDisabled) {
      return
    }

    resetEntryMessages()
    mutatingEntryId.value = entry.id

    try {
      const nextIsPacked = entry.isPacked === false
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries/${entry.id}`, {
        method: 'PATCH',

        body: {
          isPacked: nextIsPacked
        }
      })

      const updatedEntry = normalizePackingListEntry(response.entry)
      const normalizedUpdatedAt = normalizeDateString(response.packingListUpdatedAt)

      updatePackingListState({
        entries: packingList.value.entries.map((currentEntry) => {
          if (currentEntry.id !== updatedEntry.id) {
            return currentEntry
          }

          return updatedEntry
        }),
        updatedAt: normalizedUpdatedAt
      })
    } catch {
      entryMutationErrorMessage.value = 'Could not update item.'
    } finally {
      mutatingEntryId.value = null
    }
  }

  async function handleDeleteEntry(entry: PackingListEntryView) {
    if (entry.isDisabled) {
      return
    }

    resetEntryMessages()
    mutatingEntryId.value = entry.id

    try {
      const response = await requestFetch(`/api/user/packing-lists/${packingListId}/entries/${entry.id}`, {
        method: 'DELETE'
      })

      updatePackingListState({
        entries: packingList.value.entries.filter((currentEntry) => currentEntry.id !== response.deletedEntryId),
        updatedAt: normalizeDateString(response.packingListUpdatedAt)
      })
    } catch {
      entryMutationErrorMessage.value = 'Could not remove item.'
    } finally {
      mutatingEntryId.value = null
    }
  }

  function showDeleteDialog() {
    deleteErrorMessage.value = null
    isDeleteDialogVisible.value = true
  }

  async function handleDeletePack() {
    if (isDeleting.value) {
      return
    }

    deleteErrorMessage.value = null
    isDeleting.value = true

    try {
      await requestFetch(`/api/user/packing-lists/${packingListId}`, {
        method: 'DELETE'
      })

      await navigateTo('/packs')
    } catch (error) {
      const statusCode = getErrorStatusCode(error)

      if (statusCode === 404) {
        await navigateTo('/packs')

        return
      }

      deleteErrorMessage.value = 'Could not delete pack.'
    } finally {
      isDeleting.value = false
    }
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .content {
    display: grid;
    gap: var(--spacing-24);
  }

  .dangerContent {
    display: grid;
    gap: var(--spacing-16);
    justify-items: start;
  }

  .confirmationBody {
    display: grid;
    gap: var(--spacing-12);
  }

  .overviewCard {
    container-type: inline-size;
    overflow: hidden;
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-accent-primary), transparent 94%),
        var(--color-surface-primary) 58%
      );
  }

  .overviewHeader {
    display: grid;
    gap: var(--spacing-24);
  }

  .overviewAside {
    display: grid;
    gap: var(--spacing-16);
    min-inline-size: 0;
  }

  .titleRow {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
    min-inline-size: 0;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--border-radius-16);
    background-color: var(--color-accent-subtle);
    color: var(--color-accent-primary);
    font-size: 1.1rem;
  }

  .titleBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .title {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-24);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
    overflow-wrap: anywhere;
  }

  .modeToggle {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    inline-size: 100%;
    padding: var(--spacing-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
  }

  .modeButton {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-8);
    min-block-size: 2.5rem;
    min-inline-size: 0;
    padding-inline: var(--spacing-12);
    border: 0;
    border-radius: var(--border-radius-12);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    text-align: center;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }

    &:global(.active) {
      background: var(--color-surface-primary);
      color: var(--color-text-primary);
      box-shadow: 0 1px 2px color-mix(in oklch, var(--color-text-primary), transparent 92%);
    }
  }

  .metaValue {
    margin: 0;
    margin-block-start: var(--spacing-4);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  .checklistCard {
    display: grid;
    gap: var(--spacing-24);
    container-type: inline-size;
  }

  .checklistHeader {
    display: grid;
    gap: var(--spacing-16);
    padding-block-end: var(--spacing-16);
    border-block-end: 1px solid var(--color-border-subtle);
  }

  .checklistTitleBlock {
    display: grid;
    gap: var(--spacing-8);
  }

  .checklistSummary {
    margin: 0;
    max-inline-size: 42rem;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .planningPanel {
    display: grid;
    gap: var(--spacing-24);
  }

  .entryForm {
    display: grid;
    gap: var(--spacing-12);
    align-items: end;
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background:
      linear-gradient(
        145deg,
        var(--color-surface-secondary),
        color-mix(in oklch, var(--color-accent-subtle), transparent 72%)
      );

    @container (inline-size >= 42rem) {
      grid-template-columns: minmax(0, 1fr) auto;
    }
  }

  .entryField {
    display: grid;
    gap: var(--spacing-8);
    min-inline-size: 0;
  }

  .inputLabel {
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
  }

  .inputShell {
    display: flex;
    align-items: center;
    gap: var(--spacing-8);
    min-block-size: 2.75rem;
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background: var(--color-background-elevated);
    color: var(--color-text-primary);
    transition:
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:focus-within {
      border-color: var(--color-accent-primary);
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }
  }

  .inputIcon {
    flex-shrink: 0;
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .input {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    outline: 0;

    &::placeholder {
      color: var(--color-text-muted);
    }

    &:disabled {
      color: var(--color-text-muted);
    }
  }

  .inventorySection {
    display: grid;
    gap: var(--spacing-16);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
  }

  .inventoryHeader {
    display: grid;
    gap: var(--spacing-8);
  }

  .sectionEyebrow {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    text-transform: uppercase;
  }

  .sectionTitle {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-16);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
  }

  .helperMessage {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
    overflow-wrap: anywhere;
  }

  .inventoryPickerList {
    display: grid;
    gap: var(--spacing-8);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .inventoryPickerItem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background: var(--color-background-elevated);

    & > :last-child {
      justify-self: end;
    }

    @container (inline-size < 34rem) {
      grid-template-columns: minmax(0, 1fr);

      & > :last-child {
        justify-self: stretch;
      }
    }
  }

  .inventoryPickerText {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .inventoryPickerName {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  .inventoryPickerMeta {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    overflow-wrap: anywhere;
  }

  .emptyChecklist {
    display: grid;
    gap: var(--spacing-12);
    justify-items: center;
    padding: var(--spacing-24);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
    text-align: center;
  }

  .emptyIcon {
    font-size: 2.5rem;
    line-height: 1;
  }

  .emptyCopy {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .entryList {
    display: grid;
    gap: var(--spacing-8);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .entryItem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-12);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-12);
    background: var(--color-background-elevated);
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard);

    &:global(.packed) {
      background: color-mix(in oklch, var(--color-success-subtle), var(--color-background-elevated) 58%);
      border-color: color-mix(in oklch, var(--color-success-primary), transparent 72%);
    }

    & > :last-child {
      justify-self: end;
    }

    @container (inline-size < 34rem) {
      grid-template-columns: minmax(0, 1fr);

      & > :last-child {
        justify-self: stretch;
      }
    }
  }

  .entrySummary {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .entryToggle {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
    inline-size: 100%;
    min-inline-size: 0;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .entryCheckbox {
    inline-size: 1.15rem;
    block-size: 1.15rem;
    accent-color: var(--color-accent-primary);
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
    }
  }

  .entryText {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .entryName {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;

    .entryItem:global(.packed) & {
      color: var(--color-text-muted);
      text-decoration: line-through;
    }
  }

  .entryMeta {
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    overflow-wrap: anywhere;
  }

  .entryState {
    inline-size: fit-content;
    padding: 0.125rem var(--spacing-8);
    border-radius: var(--border-radius-pill);
    background: var(--color-surface-secondary);
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);

    .entryItem:global(.packed) & {
      background: var(--color-success-subtle);
      color: var(--color-success-primary);
    }
  }

  .dangerCopy {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .confirmationCopy {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
    overflow-wrap: anywhere;
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .metaLabel {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .metaGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    inline-size: 100%;
    gap: 0;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: color-mix(in oklch, var(--color-surface-primary), var(--color-surface-secondary) 52%);

    @container (inline-size < 34rem) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .metaItem {
    min-inline-size: 0;
    padding: var(--spacing-12);

    & + & {
      border-inline-start: 1px solid var(--color-border-subtle);
    }

    @container (inline-size < 34rem) {
      & + & {
        border-block-start: 1px solid var(--color-border-subtle);
        border-inline-start: 0;
      }
    }
  }

  .dangerCard {
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-danger-primary), transparent 94%),
        var(--color-surface-primary)
      );
  }

  @container (inline-size >= 48rem) {
    .overviewHeader {
      grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem);
      align-items: start;
    }

    .overviewAside {
      inline-size: 100%;
      justify-items: end;
    }
  }
</style>
