<template>
  <PageContent :page-title="itemName">
    <EmptyState
      v-if="error"
      :icon="errorIcon"
    >
      {{ errorText }}
    </EmptyState>

    <code v-else>¯\(ツ)/¯</code>
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import EmptyState from '~/components/EmptyState.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const brandId = route.params.brandId?.toString() ?? ''
  const itemName = ref('')
  const { data, error } = await useFetch(`/api/brands/${brandId}`)

  itemName.value = data.value?.name ?? '¯\\_(ツ)_/¯'

  const errorIcon = computed(() => {
    if (error.value?.statusCode === 404) {
      return 'streamline-emojis:man-shrugging-1'
    }

    return 'streamline-emojis:face-screaming-in-fear'
  })

  const errorText = computed(() => {
    if (error.value?.statusCode === 404) {
      return `Item with ID ${brandId} not found`
    }

    return 'Something went wrong'
  })

</script>
