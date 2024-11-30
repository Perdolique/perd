<template>
  <PageContent :page-title="brandName">
    <template
      v-if="hasActions"
      #actions
    >
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
          icon="tabler:trash"
          @click="showDeleteConfirmation"
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
      <PerdHeading :level="2">
        Details
      </PerdHeading>

      <ul>
        <li>
          <strong>Name: </strong> {{ brandName }}
        </li>

        <li>
          <strong>Website: </strong>

          <PerdLink
            v-if="data?.websiteUrl"
            :to="data.websiteUrl"
            target="_blank"
          >
            {{ data.websiteUrl }}
          </PerdLink>

          <span v-else>
            N/A
          </span>
        </li>

        <li>
          <strong>Equipment items: </strong> {{ itemsCount }}
        </li>
      </ul>
    </div>
  </PageContent>

  <ConfirmationDialog
    v-model="isDeleteDialogOpened"
    header-text="Delete brand"
    confirm-button-text="Delete"
    @confirm="deleteBrand"
  >
    Brand <strong>{{ brandName }}</strong> will be deleted
  </ConfirmationDialog>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import EmptyState from '~/components/EmptyState.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdMenu from '~/components/PerdMenu.vue'
  import OptionButton from '~/components/PerdMenu/OptionButton.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PerdLink from '~/components/PerdLink.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const router = useRouter()
  const { user } = useUserStore()
  const { addToast } = useToaster()
  const { showErrorToast } = useApiErrorToast()
  const brandId = route.params.brandId?.toString() ?? ''
  const brandName = ref('')
  const itemsCount = ref(0)
  const isDeleting = ref(false)
  const isDeleteDialogOpened = ref(false)
  const { data, error } = await useFetch(`/api/brands/${brandId}`)
  const hasActions = computed(() => user.value.isAdmin && error.value === undefined)

  brandName.value = data.value?.name ?? '¯\\_(ツ)_/¯'
  itemsCount.value = data.value?.equipmentCount ?? 0

  const errorIcon = computed(() => {
    if (error.value?.statusCode === 404) {
      return 'streamline-emojis:man-shrugging-1'
    }

    return 'streamline-emojis:face-screaming-in-fear'
  })

  const errorText = computed(() => {
    if (error.value?.statusCode === 404) {
      return `Brand with ID ${brandId} not found`
    }

    return 'Something went wrong'
  })

  async function deleteBrand() {
    if (isDeleting.value) {
      return
    }

    try {
      isDeleting.value = true

      await $fetch(`/api/brands/${brandId}`, {
        method: 'delete'
      })

      addToast({
        title: 'Brand deleted',
        message: `Brand ${brandName.value} has been deleted`
      })

      await navigateTo('/brands', {
        replace: true
      })
    } catch (error) {
      showErrorToast(error, 'Failed to delete brand')
    } finally {
      isDeleting.value = false
    }
  }

  function showDeleteConfirmation() {
    isDeleteDialogOpened.value = true
  }

  function onEdit() {
    router.push(`/brands/details/${brandId}/edit`)
  }
</script>

<style lang="scss" module>
  .content {
    display: grid;
    row-gap: var(--spacing-16);
  }
</style>
