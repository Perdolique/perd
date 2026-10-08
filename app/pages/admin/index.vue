<template>
  <PageContent page-title="Admin">
    <div :class="$style.component">
      <ActionPanel
        icon="hugeicons:tag-01"
        subtitle="Add, rename, and remove brands used by the gear catalog."
        title="Manage brands"
        :to="appLocations.adminEquipmentBrands"
      />

      <ActionPanel
        icon="hugeicons:folder-01"
        subtitle="Add, rename, and remove categories used by the gear catalog."
        title="Manage categories"
        :to="appLocations.adminEquipmentCategories"
      />

      <ActionPanel
        icon="hugeicons:task-edit-01"
        subtitle="Check and correct pending gear before a publish decision."
        title="Review gear submissions"
        :to="appLocations.adminEquipmentSubmissions"
      />

      <ActionPanel
        icon="hugeicons:image-02"
        subtitle="Publish or reject private photos submitted for catalog items."
        title="Review photo submissions"
        :to="appLocations.adminEquipmentPhotoSubmissions"
      />
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { definePageMeta } from '#imports'
  import ActionPanel from '~/components/ActionPanel.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appLocations } from '~/utils/navigation'

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
