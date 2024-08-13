<template>
  <PageLayout>
    <PageContent :page-title="title">
      <slot />
    </PageContent>
  </PageLayout>
</template>

<script lang="ts" setup>
  import PageLayout from '~/layouts/page.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  const route = useRoute()

  const title = computed(
    () => typeof route.meta.title === 'string' ? route.meta.title : ''
  )
</script>
