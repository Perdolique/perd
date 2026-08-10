<template>
  <PageContent page-title="Admin">
    <ActionPanel
      :class="$style.component"
      icon="hugeicons:task-edit-01"
      subtitle="Check and correct pending gear before a publish decision."
      title="Review gear submissions"
      :to="appRoutes.adminEquipmentSubmissions"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { definePageMeta } from '#imports'
  import ActionPanel from '~/components/ActionPanel.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes } from '~/utils/navigation'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })
</script>

<style module>
  .component {
    max-inline-size: 48rem;
  }
</style>
