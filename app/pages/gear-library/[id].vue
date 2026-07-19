<template>
  <PageContent :page-title="pageTitle" />
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, useFetch, useRoute } from '#imports'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()

  const itemId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id

  const { data: itemResponse } = await useFetch(`/api/equipment/items/${itemId}`)
  const pageTitle = computed(() => itemResponse.value?.name ?? 'Gear item')
</script>
