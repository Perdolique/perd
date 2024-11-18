<template>
  <PageContent :page-title="itemName">
    <template #actions>
      <PerdMenu
        icon="tabler:adjustments"
        text="Manage"
      >
        <OptionButton
          icon="tabler:pencil"
          @click="onEdit"
        >
          Edit
        </OptionButton>

        <OptionButton
          icon="tabler:trash"
          @click="onDelete"
        >
          Delete
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
</template>

<script lang="ts" setup>
  import EmptyState from '~/components/EmptyState.vue';
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdHeading from '~/components/PerdHeading.vue';
  import PerdMenu from '~/components/PerdMenu.vue';
  import OptionButton from '~/components/PerdMenu/OptionButton.vue';
  import PerdTag from '~/components/PerdTag.vue';

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const router = useRouter()
  const { addToast } = useToaster()
  const itemId = computed(() => route.params.itemId)
  const itemName = ref('')
  const description = ref('')
  const { data, error } = await useFetch(`/api/equipment/items/${itemId.value}`)

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
      return `Item with ID ${itemId.value} not found`
    }

    return 'Something went wrong'
  })

  const weight = computed(() => data.value?.equipment.weight ?? 0)
  const formattedWeight = computed(() => formatWeight(weight.value))

  function onEdit() {
    router.push(`/equipment/item/${itemId.value}/edit`)
  }

  function onDelete() {
    // TODO: Implement deletion
    addToast({
      title: '¯\\(ツ)/¯',
      message: 'This feature is not implemented yet'
    })
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
