<template>
  <PageContent :page-title="pageTitle">
    <template v-if="showImageManagementAction" #actions>
      <PerdLink :to="imagesManagementPath">
        Manage images
      </PerdLink>
    </template>

    <EquipmentItemImage
      v-if="itemResponse"
      :class="$style.image"
      :alt="itemResponse.name"
      :cloudflare-image-id="itemResponse.cloudflareImageId"
      fit="inside"
      :height="840"
      loading="eager"
      preload
      sizes="sm:100vw lg:75vw 2xl:1120px"
      :width="1120"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { definePageMeta, useFetch, useRoute, useUserStore } from '#imports'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import EquipmentItemImage from '~/components/equipment/EquipmentItemImage.vue'

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

<style module>
  .image {
    inline-size: min(100%, 75rem);
    aspect-ratio: 4 / 3;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
    object-fit: contain;
  }
</style>
