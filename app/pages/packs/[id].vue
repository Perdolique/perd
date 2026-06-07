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
        <PackingListDetailOverview
          v-model:mode="detailMode"
          :name="packingList.name"
          :entry-count="entryCount"
          :packed-count="packedCount"
          :updated-at="packingList.updatedAt"
          :formatted-updated-at="formattedUpdatedAt"
        />

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

          <PackingListPlanningPanel
            v-if="isPlanningMode"
            v-model="newEntryName"
            :inventory-rows="availableInventoryRows"
            :creating-inventory-id="creatingInventoryId"
            :is-any-entry-action-pending="isAnyEntryActionPending"
            :is-creating-custom-entry="isCreatingCustomEntry"
            :is-create-custom-entry-disabled="isCreateCustomEntryDisabled"
            :create-entry-described-by="createEntryDescribedBy"
            :is-inventory-loading="isInventoryLoading"
            :has-inventory-error="hasInventoryError"
            :is-inventory-empty="isInventoryEmpty"
            :is-available-inventory-empty="isAvailableInventoryEmpty"
            @create-custom-entry="handleCreateCustomEntry"
            @create-inventory-entry="handleCreateInventoryEntry"
          />

          <PackingListEntryList
            :mode="detailMode"
            :entries="entryViews"
            :empty-state-copy="emptyStateCopy"
            :create-entry-error-message="createEntryErrorMessage"
            :entry-mutation-error-message="entryMutationErrorMessage"
            @toggle-entry="handleToggleEntry"
            @delete-entry="handleDeleteEntry"
          />
        </PerdCard>

        <DangerActionCard
          title="Danger Zone"
          copy="Delete this pack when it is no longer useful. This action cannot be undone."
          action-text="Delete pack"
          @action="showDeleteDialog"
        />
      </div>
    </div>

    <PackingListDeleteDialog
      v-model="isDeleteDialogVisible"
      :header-text="deleteDialogHeaderText"
      :loading="isDeleting"
      :error-message="deleteErrorMessage"
      @confirm="handleDeletePack"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { definePageMeta } from '#imports'
  import { usePackingListDetail } from '~/composables/use-packing-list-detail'
  import DangerActionCard from '~/components/DangerActionCard.vue'
  import IconTitle from '~/components/IconTitle.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PackingListDeleteDialog from '~/components/packing/PackingListDeleteDialog.vue'
  import PackingListDetailOverview from '~/components/packing/PackingListDetailOverview.vue'
  import PackingListEntryList from '~/components/packing/PackingListEntryList.vue'
  import PackingListPlanningPanel from '~/components/packing/PackingListPlanningPanel.vue'

  definePageMeta({
    layout: 'page'
  })

  const {
    availableInventoryRows,
    createEntryDescribedBy,
    createEntryErrorMessage,
    creatingInventoryId,
    deleteDialogHeaderText,
    deleteErrorMessage,
    detailMode,
    detailModeIcon,
    detailModeSummary,
    detailModeTitle,
    emptyStateCopy,
    entryCount,
    entryMutationErrorMessage,
    entryViews,
    formattedUpdatedAt,
    handleCreateCustomEntry,
    handleCreateInventoryEntry,
    handleDeleteEntry,
    handleDeletePack,
    handleRetry,
    handleToggleEntry,
    hasError,
    hasInventoryError,
    isAnyEntryActionPending,
    isAvailableInventoryEmpty,
    isCreateCustomEntryDisabled,
    isCreatingCustomEntry,
    isDeleteDialogVisible,
    isDeleting,
    isInitialLoading,
    isInventoryEmpty,
    isInventoryLoading,
    isPlanningMode,
    newEntryName,
    packedCount,
    packingList,
    pageTitle,
    showDeleteDialog
  } = await usePackingListDetail()
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
</style>
