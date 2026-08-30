<template>
  <PageContent page-title="Admin">
    <div :class="$style.component">
      <ActionPanel
        icon="hugeicons:task-edit-01"
        subtitle="Check and correct pending gear before a publish decision."
        title="Review gear submissions"
        :to="appRoutes.adminEquipmentSubmissions"
      />

      <ActionPanel
        icon="hugeicons:image-02"
        subtitle="Publish or reject private photos submitted for catalog items."
        title="Review photo submissions"
        :to="appRoutes.adminEquipmentPhotoSubmissions"
      />
    </div>
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
    display: grid;
    gap: var(--spacing-16);
    max-inline-size: 48rem;
  }
</style>
