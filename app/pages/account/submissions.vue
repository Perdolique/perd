<template>
  <PageContent page-title="My contributions">
    <template #actions>
      <PerdLink :to="appRoutes.account">
        Back to account
      </PerdLink>
    </template>

    <PagePlaceholder v-if="isGuest" emoji="🔐" title="Account required.">
      Guest accounts do not have catalog contributions.
    </PagePlaceholder>

    <PageLoadingState v-else-if="isLoading" title="Loading My contributions" />

    <PagePlaceholder
      v-else-if="hasError"
      emoji="🧰"
      title="My contributions unavailable."
    >
      Could not load your submissions.

      <template #actions>
        <PerdButton variant="secondary" @click="retry">
          Retry
        </PerdButton>
      </template>
    </PagePlaceholder>

    <PagePlaceholder
      v-else-if="hasNoContributions"
      emoji="📭"
      title="No contributions yet."
    >
      Submit missing gear or a photo and its review status will appear here.

      <template #actions>
        <PerdLink :to="appRoutes.gearLibraryNew">
          Submit gear
        </PerdLink>
      </template>
    </PagePlaceholder>

    <div v-else :class="$style.content">
      <section v-if="hasItemSubmissions" :class="$style.section">
        <PerdHeading :level="2">Item submissions</PerdHeading>

        <div :class="$style.list">
          <PerdCard
            v-for="item in itemSubmissionCards"
            :key="item.id"
            :class="$style.card"
          >
            <div :class="$style.header">
              <div :class="$style.titleGroup">
                <h3 :class="$style.cardTitle">
                  <PerdLink v-if="item.detailPath" :to="item.detailPath">
                    {{ item.name }}
                  </PerdLink>

                  <template v-else>
                    {{ item.name }}
                  </template>
                </h3>

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
              <h4 :class="$style.sectionTitle">Known characteristics</h4>

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

            <div v-if="item.hasRejectionReason" :class="$style.rejection">
              <strong>Rejection reason</strong>
              <p>{{ item.rejectionReason }}</p>
            </div>
          </PerdCard>
        </div>
      </section>

      <section v-if="hasPhotoSubmissions" :class="$style.section">
        <PerdHeading :level="2">Photo submissions</PerdHeading>

        <div :class="$style.list">
          <PerdCard
            v-for="photo in photoSubmissionCards"
            :key="photo.id"
            :class="$style.card"
          >
            <div :class="$style.header">
              <div :class="$style.titleGroup">
                <h3 :class="$style.cardTitle">
                  <PerdLink :to="photo.itemPath">
                    {{ photo.itemName }}
                  </PerdLink>
                </h3>

                <p>{{ photo.filename }}</p>
                <p :class="$style.references">{{ photo.sourceLabel }}</p>

                <a
                  v-if="photo.hasSourceUrl"
                  :href="photo.sourceUrl"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Manufacturer source
                </a>
              </div>

              <PerdPill tone="warning">Pending</PerdPill>
            </div>

            <dl :class="$style.metadata">
              <div :class="$style.metadataGroup">
                <dt>Submitted</dt>

                <dd>
                  <NuxtTime
                    :datetime="photo.createdAt"
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
                    :datetime="photo.updatedAt"
                    locale="en"
                    date-style="medium"
                    time-style="short"
                  />
                </dd>
              </div>
            </dl>
          </PerdCard>
        </div>
      </section>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, useFetch, useUserStore } from '#imports'
  import { NuxtTime } from '#components'
  import type { UserItemSubmission, UserItemSubmissionProperty } from '#server/api/user/item-submissions/index.get'
  import type { UserPhotoSubmission } from '#server/api/user/photo-submissions/index.get'
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
    hasRejectionReason: boolean;
    id: string;
    name: string;
    properties: SubmissionPropertyCard[];
    rejectionReason: string | null;
    statusLabel: string;
    statusTone: PerdPillTone;
    updatedAt: Date | string;
  }

  interface PhotoSubmissionCard {
    createdAt: Date | string;
    filename: string;
    hasSourceUrl: boolean;
    id: string;
    itemName: string;
    itemPath: string;
    sourceLabel: string;
    sourceUrl: string;
    updatedAt: Date | string;
  }

  definePageMeta({ layout: 'page' })

  const { user } = useUserStore()
  const isGuest = computed(() => user.value.isGuest)

  const {
    data: itemSubmissions,
    error: itemSubmissionsError,
    refresh: refreshItemSubmissions,
    status: itemSubmissionsStatus
  } = useFetch('/api/user/item-submissions', {
    default: () => {
      return { items: [] }
    },

    immediate: isGuest.value === false,
    lazy: true
  })

  const {
    data: photoSubmissions,
    error: photoSubmissionsError,
    refresh: refreshPhotoSubmissions,
    status: photoSubmissionsStatus
  } = useFetch('/api/user/photo-submissions', {
    default: () => {
      return { items: [] }
    },

    immediate: isGuest.value === false,
    lazy: true
  })

  const isLoading = computed(
    () => itemSubmissionsStatus.value === 'pending'
      || photoSubmissionsStatus.value === 'pending'
  )

  const hasError = computed(
    () => itemSubmissionsError.value !== undefined
      || photoSubmissionsError.value !== undefined
  )

  const hasItemSubmissions = computed(() => itemSubmissions.value.items.length > 0)
  const hasPhotoSubmissions = computed(() => photoSubmissions.value.items.length > 0)

  const hasNoContributions = computed(
    () => hasItemSubmissions.value === false && hasPhotoSubmissions.value === false
  )

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
      return {
        label: 'Published',
        tone: 'success' as const
      }
    }

    if (statusValue === 'rejected') {
      return {
        label: 'Rejected',
        tone: 'danger' as const
      }
    }

    return {
      label: 'Pending',
      tone: 'warning' as const
    }
  }

  const itemSubmissionCards = computed<SubmissionCard[]>(() => itemSubmissions.value.items.map((item) => {
    const detailPath = item.status === 'approved' ? createGearLibraryItemPath(item.id) : null
    const statusPresentation = getStatusPresentation(item.status)
    const properties = item.properties.map(formatProperty)

    return {
      brandName: item.brand.name,
      categoryName: item.category.name,
      createdAt: item.createdAt,
      detailPath,
      hasProperties: properties.length > 0,
      hasRejectionReason: item.rejectionReason !== null,
      id: item.id,
      name: item.name,
      properties,
      rejectionReason: item.rejectionReason,
      statusLabel: statusPresentation.label,
      statusTone: statusPresentation.tone,
      updatedAt: item.updatedAt
    }
  }))

  function getPhotoSourceLabel(sourceType: UserPhotoSubmission['sourceType']) {
    return sourceType === 'own' ? 'Own photo' : 'Official manufacturer photo'
  }

  const photoSubmissionCards = computed<PhotoSubmissionCard[]>(
    () => photoSubmissions.value.items.map((photo) => {
      return {
        createdAt: photo.createdAt,
        filename: photo.filename,
        hasSourceUrl: photo.sourceUrl !== null,
        id: photo.id,
        itemName: photo.item.name,
        itemPath: createGearLibraryItemPath(photo.item.id),
        sourceLabel: getPhotoSourceLabel(photo.sourceType),
        sourceUrl: photo.sourceUrl ?? '',
        updatedAt: photo.updatedAt
      }
    })
  )

  async function retry() {
    await Promise.all([
      refreshItemSubmissions(),
      refreshPhotoSubmissions()
    ])
  }
</script>

<style module>
  .content,
  .section,
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

  .cardTitle {
    color: var(--color-text-primary);
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-snug);
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
