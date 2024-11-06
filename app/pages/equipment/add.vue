<template>
  <PageContent page-title="Add new equipment">
    <AddEquipmentForm />
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue';
  import AddEquipmentForm from '~/components/equipment/AddEquipmentForm.vue';

  definePageMeta({
    layout: 'page'
  })
</script>
