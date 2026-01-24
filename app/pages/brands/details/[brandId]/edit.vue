
<template>
  <PageContent page-title="Edit brand">
    <EmptyState
      v-if="error"
      :icon="errorIcon"
    >
      {{ errorText }}
    </EmptyState>

    <EditBrandForm
      v-else
      v-model:name="name"
      v-model:website-url="websiteUrl"
      :submitting="isSubmitting"
      save-button-text="Save changes"
      @submit="onSubmit"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import EmptyState from '~/components/EmptyState.vue'
  import EditBrandForm from '~/components/brands/EditBrandForm.vue'

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const route = useRoute()
  const router = useRouter()
  const brandId = route.params.brandId?.toString() ?? ''
  const name = ref('')
  const websiteUrl = ref('')
  const isSubmitting = ref(false)
  const { addToast } = useToaster()
  const { showErrorToast } = useApiErrorToast()
  const { data, error } = await useFetch(`/api/brands/${brandId}`)

  if (data.value) {
    name.value = data.value.name
    websiteUrl.value = data.value.websiteUrl ?? ''
  }

  const errorIcon = computed(() => {
    if (error.value?.status === 404) {
      return 'streamline-emojis:man-shrugging-1'
    }

    return 'streamline-emojis:face-screaming-in-fear'
  })

  const errorText = computed(() => {
    if (error.value?.status === 404) {
      return `Brand with ID ${brandId} not found`
    }

    return 'Something went wrong'
  })

  async function onSubmit() {
    if (isSubmitting.value) {
      return
    }

    try {
      isSubmitting.value = true

      await $fetch(`/api/brands/${brandId}`, {
        method: 'patch',

        body: {
          name: name.value,
          websiteUrl: websiteUrl.value || undefined
        }
      })

      addToast({
        title: 'Brand updated 🎉',
        message: 'The brand has been successfully updated'
      })

      router.push(`/brands/details/${brandId}`)
    } catch (error) {
      showErrorToast(error, 'Failed to update brand 🥲')
    } finally {
      isSubmitting.value = false
    }
  }
</script>
