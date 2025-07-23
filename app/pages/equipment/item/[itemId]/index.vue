<template>
  <PageContent :page-title="itemName">
    <template
      v-if="user.isAdmin"
      #actions
    >
      <div :class="$style.actions">
        <PerdTag
          :icon="statusIcon"
          :color="statusColor"
        >
          {{ statusText }}
        </PerdTag>

        <PerdMenu>
          <template #trigger="{ toggleMenu }">
            <PerdButton
              small
              secondary
              icon="tabler:adjustments"
              @click="toggleMenu"
            >
              Manage
            </PerdButton>
          </template>

          <OptionButton
            icon="tabler:pencil"
            @click="onEdit"
          >
            Edit
          </OptionButton>

          <OptionButton
            :icon="toggleStatusIcon"
            @click="toggleStatus"
          >
            {{ toggleStatusText }}
          </OptionButton>

          <OptionButton
            icon="tabler:trash"
            @click="showDeleteConfirmation"
          >
            Delete
          </OptionButton>
        </PerdMenu>
      </div>
    </template>

    <EmptyState
      v-if="error"
      :icon="errorIcon"
    >
      {{ errorText }}
    </EmptyState>

    <div
      v-else
      :class="$style.content"
    >
      <img
        src="/equipment-item-placeholder.webp"
        alt="Equipment item placeholder"
        :class="$style.image"
      />

      <div :class="$style.tags">
        <PerdTag
          icon="tabler:weight"
          color="gray"
        >
          {{ formattedWeight }}
        </PerdTag>

        <PerdTag
          v-if="data?.group"
          icon="tabler:cube"
          color="blue"
        >
          {{ data.group.name }}
        </PerdTag>

        <PerdTag
          v-if="data?.type"
          icon="tabler:tag"
          color="green"
        >
          {{ data.type.name }}
        </PerdTag>
      </div>

      <div :class="$style.detailsSection">
        <PerdHeading :level="2">
          Details
        </PerdHeading>

        <ul>
          <li>
            <strong>Name:</strong> {{ itemName }}
          </li>

          <li>
            <strong>Group:</strong> {{ data?.group?.name }}
          </li>

          <li>
            <strong>Type:</strong> {{ data?.type?.name }}
          </li>

          <li>
            <strong>Weight:</strong> {{ formattedWeight }}
          </li>

          <li>
            <strong>Brand:</strong> {{ brandName }}
          </li>
        </ul>
      </div>

      <div
        v-if="description"
        :class="$style.descriptionSection"
      >
        <PerdHeading :level="2">
          Description
        </PerdHeading>

        <p :class="$style.description">
          {{ description }}
        </p>
      </div>
    </div>
  </PageContent>

  <ConfirmationDialog
    v-model="isDeleteDialogOpened"
    header-text="Delete item"
    confirm-button-text="Delete"
    @confirm="deleteItem"
  >
    Item <strong>{{ itemName }}</strong> will be deleted
  </ConfirmationDialog>
</template>

<script lang="ts" setup>
  import { equipmentStatuses } from '~~/shared/models/equipment';
  import EmptyState from '~/components/EmptyState.vue';
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdHeading from '~/components/PerdHeading.vue';
  import PerdMenu from '~/components/PerdMenu.vue';
  import OptionButton from '~/components/PerdMenu/OptionButton.vue';
  import PerdTag from '~/components/PerdTag.vue';
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue';
  import PerdButton from '~/components/PerdButton.vue';

  definePageMeta({
    layout: 'page'
  })

  const defaultStatus = '?';
  const route = useRoute()
  const router = useRouter()
  const { user } = useUserStore()
  const { addToast } = useToaster()
  const itemId = route.params.itemId?.toString() ?? ''
  const itemName = ref('')
  const description = ref('')
  const { showErrorToast } = useApiErrorToast()
  const status = ref(defaultStatus)
  const isDeleting = ref(false)
  const isDeleteDialogOpened = ref(false)
  const isUpdatingStatus = ref(false)
  const { data, error } = await useFetch(`/api/equipment/items/${itemId}`)
  const weight = computed(() => data.value?.equipment.weight ?? 0)
  const formattedWeight = computed(() => formatWeight(weight.value))
  const brandName = computed(() => data.value?.brand?.name ?? '–')

  status.value = data.value?.equipment.status ?? defaultStatus
  itemName.value = data.value?.equipment.name ?? '¯\\_(ツ)_/¯'
  description.value = data.value?.equipment.description ?? ''

  const errorIcon = computed(() => {
    if (error.value?.statusCode === 404) {
      return 'streamline-emojis:man-shrugging-1'
    }

    return 'streamline-emojis:face-screaming-in-fear'
  })

  const errorText = computed(() => {
    if (error.value?.statusCode === 404) {
      return `Item with ID ${itemId} not found`
    }

    return 'Something went wrong'
  })

  const statusIcon = computed(() =>
    status.value === 'active' ? 'tabler:check' : 'tabler:pencil'
  )

  const statusColor = computed(() =>
    status.value === 'active' ? 'green' : 'yellow'
  )

  const statusText = computed(() => {
    return status.value.charAt(0).toUpperCase() + status.value.slice(1)
  })

  const toggleStatusIcon = computed(() =>
    status.value === 'draft' ? 'tabler:check' : 'tabler:eye-off'
  )

  const toggleStatusText = computed(() =>
    status.value === 'draft' ? 'Make Active' : 'Return to Draft'
  )

  async function toggleStatus() {
    if (isUpdatingStatus.value) {
      return;
    }

    try {
      isUpdatingStatus.value = true

      const newStatus = status.value === 'draft'
        ? equipmentStatuses.active
        : equipmentStatuses.draft

      await $fetch(`/api/equipment/items/${itemId}/status`, {
        method: 'PATCH',

        body: {
          status: newStatus
        }
      })

      status.value = newStatus

      addToast({
        title: 'Status updated',
        message: `Item ${itemName.value} is now ${status.value === 'active' ? 'active' : 'in draft'}`
      })
    } catch (error) {
      showErrorToast(error, 'Failed to update status')
    } finally {
      isUpdatingStatus.value = false
    }
  }

  async function deleteItem() {
    if (isDeleting.value) {
      return
    }

    try {
      isDeleting.value = true

      await $fetch(`/api/equipment/items/${itemId}`, {
        method: 'DELETE'
      })

      addToast({
        title: 'Item deleted',
        message: `Item ${itemName.value} has been deleted`
      })

      await navigateTo('/manager/equipment', {
        replace: true
      })
    } catch (error) {
      showErrorToast(error, 'Failed to delete item')
    } finally {
      isDeleting.value = false
    }
  }

  function showDeleteConfirmation() {
    isDeleteDialogOpened.value = true
  }

  function onEdit() {
    router.push(`/equipment/item/${itemId}/edit`)
  }
</script>

<style lang="scss" module>
  @mixin section() {
    display: grid;
    row-gap: var(--spacing-16);
  }

  .actions {
    display: flex;
    column-gap: var(--spacing-12);
    align-items: center;
  }

  .content {
    display: grid;
    row-gap: var(--spacing-24);
    grid-template-areas:
      'image'
      'tags'
      'details'
      'description';

    @include tablet() {
      column-gap: var(--spacing-16);
      grid-template-columns: auto 1fr;
      align-items: start;
      grid-template-areas:
        'image details'
        'tags tags'
        'description description';
    }
  }

  .image {
    grid-area: image;
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: cover;
    border-radius: var(--border-radius-24);
    max-width: 400px;
  }

  .detailsSection {
    @include section();

    grid-area: details;
  }

  .descriptionSection {
    @include section();

    grid-area: description;
  }

  .description {
    white-space: pre-wrap;
    color: var(--text-color-secondary);
    line-height: 1.5;
    text-wrap: balance;
    overflow: auto;
  }

  .tags {
    grid-area: tags;
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);
  }
</style>
