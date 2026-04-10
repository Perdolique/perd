<template>
  <PageContent page-title="Catalog">
    <div :class="$style.component">
      <PagePlaceholder emoji="🎒" title="Catalog is being rebuilt.">
        This area is temporarily a placeholder while we rebuild the browsing flow in staged iterations on top of the existing read APIs.
      </PagePlaceholder>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { definePageMeta } from '#imports'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })
</script>

<style module>
  .component {
    min-height: min(60vh, 32rem);
    width: 100%;
    display: grid;
    place-items: center;
  }
</style>
