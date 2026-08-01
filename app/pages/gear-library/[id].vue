<template>
  <PageContent :page-title="pageTitle">
    <template v-if="showImageManagementAction" #actions>
      <PerdLink :to="imagesManagementPath">
        Manage images
      </PerdLink>
    </template>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, useFetch, useRoute, useUserStore } from '#imports'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdLink from '~/components/PerdLink.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()

  const itemId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id

  const { user } = useUserStore()
  const { data: itemResponse } = await useFetch(`/api/equipment/items/${itemId}`)
  const pageTitle = computed(() => itemResponse.value?.name ?? 'Gear item')
  const imagesManagementPath = `/admin/equipment/items/${itemId}/images`
  const showImageManagementAction = computed(() => user.value.isAdmin)
</script>
