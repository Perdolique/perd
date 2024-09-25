<template>
  <PageContent page-title="Equipment types">
    Groups page
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue';

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })
</script>
