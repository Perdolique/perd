<template>
  <PageContent :page-title="itemName">
    <template #actions>
      <PerdMenu v-if="user.isAdmin">
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
          icon="tabler:trash"
          @click="showDeleteConfirmation"
        >
          <template v-if="isDeleting">
            Deleting...
          </template>

          <template v-else>
            Delete
          </template>
        </OptionButton>
      </PerdMenu>
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
        src="public/equipment-item-placeholder.webp"
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

  const route = useRoute()
  const router = useRouter()
  const { user } = useUserStore()
  const { addToast } = useToaster()
  const itemId = route.params.itemId?.toString() ?? ''
  const itemName = ref('')
  const description = ref('')
  const { data, error } = await useFetch(`/api/equipment/items/${itemId}`)

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

  const weight = computed(() => data.value?.equipment.weight ?? 0)
  const formattedWeight = computed(() => formatWeight(weight.value))
  const isDeleting = ref(false)
  const isDeleteDialogOpened = ref(false)
  const { showErrorToast } = useApiErrorToast()

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
