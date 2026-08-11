<template>
  <PageContent page-title="Gear submissions">
    <template #actions>
      <PerdLink :to="appRoutes.account">
        Back to account
      </PerdLink>
    </template>

    <PagePlaceholder v-if="isGuest" emoji="🔐" title="Account required.">
      Guest accounts do not have gear submissions.
    </PagePlaceholder>

    <PageLoadingState v-else-if="isLoading" title="Loading gear submissions" />

    <PagePlaceholder
      v-else-if="hasError"
      emoji="🧰"
      title="Gear submissions unavailable."
    >
      Could not load your submissions.

      <template #actions>
        <PerdButton variant="secondary" @click="retry">
          Retry
        </PerdButton>
      </template>
    </PagePlaceholder>

    <PagePlaceholder
      v-else-if="hasNoSubmissions"
      emoji="📭"
      title="No gear submissions yet."
    >
      Submit missing gear and its review status will appear here.

      <template #actions>
        <PerdLink :to="appRoutes.gearLibraryNew">
          Submit gear
        </PerdLink>
      </template>
    </PagePlaceholder>

    <div v-else :class="$style.list">
      <PerdCard
        v-for="item in submissionCards"
        :key="item.id"
        :class="$style.card"
      >
        <div :class="$style.header">
          <div :class="$style.titleGroup">
            <PerdHeading :level="2">
              <PerdLink v-if="item.detailPath" :to="item.detailPath">
                {{ item.name }}
              </PerdLink>

              <template v-else>
                {{ item.name }}
              </template>
            </PerdHeading>

            <p :class="$style.references">
              {{ item.brandName }} · {{ item.categoryName }}
            </p>
          </div>

          <PerdPill :tone="item.statusTone">
            {{ item.statusLabel }}
          </PerdPill>
        </div>

        <dl :class="$style.metadata">
          <div :class="$style.metadataGroup">
            <dt>Submitted</dt>

            <dd>
              <NuxtTime
                :datetime="item.createdAt"
                locale="en"
                date-style="medium"
                time-style="short"
              />
            </dd>
          </div>

          <div :class="$style.metadataGroup">
            <dt>Last updated</dt>

            <dd>
              <NuxtTime
                :datetime="item.updatedAt"
                locale="en"
                date-style="medium"
                time-style="short"
              />
            </dd>
          </div>
        </dl>

        <div v-if="item.hasProperties" :class="$style.properties">
          <h3 :class="$style.sectionTitle">Known characteristics</h3>

          <dl :class="$style.propertyList">
            <div
              v-for="property in item.properties"
              :key="property.propertyId"
              :class="$style.property"
            >
              <dt>{{ property.name }}</dt>
              <dd>{{ property.displayValue }}</dd>
            </div>
          </dl>
        </div>

        <div v-if="item.rejectionReason !== null" :class="$style.rejection">
          <strong>Rejection reason</strong>
          <p>{{ item.rejectionReason }}</p>
        </div>
      </PerdCard>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, useFetch, useUserStore } from '#imports'
  import { NuxtTime } from '#components'

  import type {
    UserItemSubmission,
    UserItemSubmissionProperty
  } from '#server/api/user/item-submissions/index.get'

  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PerdPill, { type PerdPillTone } from '~/components/PerdPill.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes, createGearLibraryItemPath } from '~/utils/navigation'

  interface SubmissionPropertyCard {
    displayValue: string;
    name: string;
    propertyId: number;
  }

  interface SubmissionCard {
    brandName: string;
    categoryName: string;
    createdAt: Date | string;
    detailPath: string | null;
    hasProperties: boolean;
    id: string;
    name: string;
    properties: SubmissionPropertyCard[];
    rejectionReason: string | null;
    statusLabel: string;
    statusTone: PerdPillTone;
    updatedAt: Date | string;
  }

  definePageMeta({ layout: 'page' })

  const { user } = useUserStore()
  const isGuest = computed(() => user.value.isGuest)

  const {
    data: submissions,
    error,
    refresh,
    status
  } = useFetch('/api/user/item-submissions', {
    default: () => {
      return { items: [] }
    },
    immediate: isGuest.value === false,
    lazy: true
  })

  const isLoading = computed(() => status.value === 'pending')
  const hasError = computed(() => error.value !== undefined)
  const hasNoSubmissions = computed(() => submissions.value.items.length === 0)

  function formatBoolean(value: boolean) {
    return value ? 'Yes' : 'No'
  }

  function formatProperty(property: UserItemSubmissionProperty): SubmissionPropertyCard {
    const {
      name,
      propertyId,
      unit,
      value: rawValue
    } = property

    const value = typeof rawValue === 'boolean' ? formatBoolean(rawValue) : rawValue

    const displayValue = unit === null ? value : `${value} ${unit}`

    return {
      displayValue,
      name,
      propertyId
    }
  }

  function getStatusPresentation(statusValue: UserItemSubmission['status']) {
    if (statusValue === 'approved') {
      return { label: 'Published', tone: 'success' as const }
    }

    if (statusValue === 'rejected') {
      return { label: 'Rejected', tone: 'danger' as const }
    }

    return { label: 'Pending', tone: 'warning' as const }
  }

  const submissionCards = computed<SubmissionCard[]>(() => submissions.value.items.map((item) => {
    const detailPath = item.status === 'approved' ? createGearLibraryItemPath(item.id) : null
    const statusPresentation = getStatusPresentation(item.status)
    const properties = item.properties.map(formatProperty)

    return {
      brandName: item.brand.name,
      categoryName: item.category.name,
      createdAt: item.createdAt,
      detailPath,
      hasProperties: properties.length > 0,
      id: item.id,
      name: item.name,
      properties,
      rejectionReason: item.rejectionReason,
      statusLabel: statusPresentation.label,
      statusTone: statusPresentation.tone,
      updatedAt: item.updatedAt
    }
  }))

  async function retry() {
    await refresh()
  }
</script>

<style module>
  .list,
  .card,
  .properties,
  .rejection {
    display: grid;
    gap: var(--spacing-16);
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-12);
    align-items: start;
  }

  .titleGroup,
  .metadataGroup,
  .property {
    display: grid;
    gap: var(--spacing-4);
  }

  .references,
  .metadata,
  .propertyList {
    color: var(--color-text-tertiary);
  }

  .metadata,
  .propertyList {
    display: grid;
    gap: var(--spacing-12);
  }

  .metadata {
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }

  .metadataGroup dt,
  .property dt,
  .sectionTitle {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .propertyList {
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }

  .property,
  .rejection {
    padding: var(--spacing-12);
    border-radius: var(--border-radius-12);
    background: var(--color-surface-secondary);
  }

  .rejection {
    color: var(--color-danger-primary);
    border: 1px solid var(--color-danger-subtle);
  }
</style>
