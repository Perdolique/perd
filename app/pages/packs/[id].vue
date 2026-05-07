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
        description="We are loading this pack right now."
      />

      <PagePlaceholder v-else-if="hasError" emoji="🧭" title="This pack is temporarily unavailable.">
        We could not load this pack right now. Try this request again.

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
                <p :class="$style.label">
                  Pack
                </p>

                <h2 :class="$style.title">
                  {{ packingList.name }}
                </h2>
              </div>
            </div>

            <div :class="$style.metaGrid">
              <div :class="$style.metaItem">
                <p :class="$style.metaLabel">
                  Items
                </p>

                <p :class="$style.metaValue">
                  0
                </p>
              </div>

              <div :class="$style.metaItem">
                <p :class="$style.metaLabel">
                  Updated
                </p>

                <p :class="$style.metaValue">
                  <time :datetime="packingList.updatedAt">{{ formattedUpdatedAt }}</time>
                </p>
              </div>
            </div>
          </div>
        </PerdCard>

        <PagePlaceholder emoji="🎒" title="No items in this pack yet.">
          Nothing is assigned to this pack right now.
        </PagePlaceholder>

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
      :confirm-loading="isDeleteInFlight"
      :confirm-disabled="isDeleteInFlight"
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
  import { computed, ref } from 'vue'
  import { definePageMeta, navigateTo, useFetch, useRequestFetch, useRoute } from '#imports'
  import { packingListDateFormatter } from '~/utils/packing'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import IconTitle from '~/components/IconTitle.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  interface FetchStatusError {
    response?: FetchStatusResponse;
    status?: number;
    statusCode?: number;
  }

  interface FetchStatusResponse {
    status?: number;
  }

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const packingListId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id

  const requestFetch = useRequestFetch()
  const isDeleteDialogVisible = ref(false)
  const isDeleting = ref(false)
  const deleteErrorMessage = ref<string | null>(null)

  const {
    data: packingList,
    error: packingListError,
    refresh: refreshPackingList,
    status: packingListStatus
  } = await useFetch(`/api/user/packing-lists/${packingListId}`, {
    default: () => {
      return {
        createdAt: '',
        id: '',
        name: '',
        updatedAt: ''
      }
    },

    lazy: true
  })

  const hasError = computed(() => packingListError.value !== undefined && packingListError.value !== null)
  const isDeleteInFlight = computed(() => isDeleting.value)
  const isInitialLoading = computed(() => packingListStatus.value === 'pending')
  const pageTitle = computed(() => hasError.value ? 'Pack' : packingList.value.name)
  const deleteDialogHeaderText = computed(() => `Delete "${packingList.value.name}"?`)
  const formattedUpdatedAt = computed(() => {
    if (packingList.value.updatedAt === '') {
      return ''
    }

    return packingListDateFormatter.format(new Date(packingList.value.updatedAt))
  })

  function getErrorStatusCode(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return null
    }

    const fetchError = error as FetchStatusError

    return fetchError.statusCode ?? fetchError.status ?? fetchError.response?.status
  }

  async function handleRetry() {
    await refreshPackingList()
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

      deleteErrorMessage.value = 'We could not delete this pack right now.'
    } finally {
      isDeleting.value = false
    }
  }
</script>

<style module>
  .component,
  .content,
  .dangerContent,
  .confirmationBody {
    display: grid;
  }

  .component,
  .content {
    gap: var(--spacing-24);
  }

  .overviewCard {
    container-type: inline-size;
  }

  .overviewHeader {
    display: grid;
    gap: var(--spacing-16);

    @container (inline-size >= 40rem) {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
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
    color: var(--color-accent-base);
    font-size: 1.1rem;
  }

  .titleBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .label,
  .title,
  .metaLabel,
  .metaValue,
  .dangerCopy,
  .confirmationCopy,
  .errorMessage {
    margin: 0;
  }

  .label,
  .metaLabel {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .title {
    color: var(--color-text-primary);
    font-size: var(--font-size-20);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
    overflow-wrap: anywhere;
  }

  .metaGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, auto));
    gap: var(--spacing-16);

    @container (inline-size >= 40rem) {
      justify-content: end;
      text-align: right;
    }
  }

  .metaItem {
    min-inline-size: 0;
  }

  .metaValue {
    margin-block-start: var(--spacing-4);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  .dangerCard {
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-danger), transparent 94%),
        var(--color-surface-base)
      );
  }

  .dangerContent {
    gap: var(--spacing-16);
    justify-items: start;
  }

  .dangerCopy,
  .confirmationCopy {
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .confirmationBody {
    gap: var(--spacing-12);
  }

  .errorMessage {
    color: var(--color-danger);
  }
</style>
