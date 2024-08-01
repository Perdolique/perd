<template>
  <PageContent :page-title="name">
    <PerdButton
      :disabled="isDeleting"
      @click="deleteChecklist"
    >
      Delete
    </PerdButton>
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/page-content.vue'
  import PerdButton from '~/components/PerdButton.vue';

  const route = useRoute()
  const name = ref('')
  const id = ref('')
  const isDeleting = ref(false)
  const { data } = await useFetch(`/api/checklists/${route.params.id}`)

  if (data.value !== undefined) {
    name.value = data.value.name
    id.value = data.value.id
  } else {
    await navigateTo('/checklists', {
      replace: true
    })
  }

  async function deleteChecklist() {
    try {
      isDeleting.value = true

      await $fetch(`/api/checklists/${id.value}`, {
        method: 'DELETE'
      })

      await navigateTo('/checklists', {
        replace: true
      })
    } catch (error) {
      console.error(error)
    } finally {
      isDeleting.value = false
    }
  }
</script>
