
<template>
  <PageContent page-title="Add new brand">
    <EditBrandForm
      v-model:name="name"
      v-model:website-url="websiteUrl"
      :submitting="isSubmitting"
      save-button-text="Add brand"
      @submit="onSubmit"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import EditBrandForm from '~/components/brands/EditBrandForm.vue'

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const name = ref('')
  const websiteUrl = ref('')
  const isSubmitting = ref(false)
  const { addToast } = useToaster()
  const { showErrorToast } = useApiErrorToast()

  function resetForm() {
    name.value = ''
    websiteUrl.value = ''
  }

  async function onSubmit() {
    if (isSubmitting.value) {
      return
    }

    try {
      isSubmitting.value = true

      const websiteUrlValue = websiteUrl.value === '' ? undefined : websiteUrl.value

      await $fetch('/api/brands', {
        method: 'post',

        body: {
          name: name.value,
          websiteUrl: websiteUrlValue
        }
      })

      addToast({
        title: 'Brand added 🎉',
        message: 'The brand has been successfully added'
      })

      resetForm()
    } catch (error) {
      showErrorToast(error, 'Failed to add brand 🥲')
    } finally {
      isSubmitting.value = false
    }
  }
</script>
