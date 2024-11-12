<template>
  <PageContent page-title="Edit equipment item">
    <EditEquipmentForm
      v-if="data"
      v-model:name="name"
      v-model:description="description"
      v-model:weight="weight"
      v-model:type-id="typeId"
      v-model:group-id="groupId"
      :groups="groupOptions"
      :types="typeOptions"
      :submitting="isSubmitting"
      save-button-text="Save changes"
      @submit="onSubmit"
    />

    <EmptyState
      v-else
      :icon="errorIcon"
    >
      {{ errorText }}
    </EmptyState>
  </PageContent>
</template>

<script lang="ts" setup>
  import { FetchError } from 'ofetch'
  import EditEquipmentForm from '~/components/equipment/EditEquipmentForm.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import EmptyState from '~/components/EmptyState.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const router = useRouter()
  const isSubmitting = ref(false)
  const { addToast } = useToaster()

  // TODO: create an utility function
  const itemId = computed(() => route.params.itemId?.toString() ?? '')

  // TODO: use useAsyncData
  const { data, error } = await useFetch(`/api/equipment/items/${itemId.value}`)
  const { groups, fetchGroups } = useEquipmentGroupsState()
  const { types, fetchTypes } = useEquipmentTypesState()

  await Promise.all([fetchGroups(), fetchTypes()])

  const name = ref(data.value?.equipment.name ?? '')
  const description = ref(data.value?.equipment.description ?? '')
  const weight = ref(data.value?.equipment.weight.toString() ?? '')
  const typeId = ref(data.value?.group?.id.toString() ?? '')
  const groupId = ref(data.value?.type?.id.toString() ?? '')

  const groupOptions = computed(() => {
    return groups.value.map((group) => ({
      value: group.id.toString(),
      label: group.name
    }))
  })

  const typeOptions = computed(() => {
    return types.value.map((type) => ({
      value: type.id.toString(),
      label: type.name
    }))
  })

  // TODO: move to composables
  const errorIcon = computed(() => {
    if (error.value?.statusCode === 404) {
      return 'streamline-emojis:man-shrugging-1'
    }

    return 'streamline-emojis:face-screaming-in-fear'
  })

  const errorText = computed(() => {
    if (error.value?.statusCode === 404) {
      return `Item with ID ${itemId.value} not found`
    }

    return 'Something went wrong'
  })

  async function onSubmit() {
    if (isSubmitting.value) {
      return
    }

    try {
      isSubmitting.value = true

      await $fetch(`/api/equipment/items/${itemId.value}`, {
        method: 'PATCH',
        body: {
          name: name.value,
          description: description.value,
          weight: parseInt(weight.value),
          typeId: parseInt(typeId.value),
          groupId: parseInt(groupId.value)
        }
      })

      addToast({
        title: 'Equipment updated 🎉',
        message: 'The equipment has been successfully updated'
      })

      router.push(`/equipment/item/${itemId.value}`)
    } catch (error) {
      if (error instanceof FetchError) {
        addToast({
          title: 'Failed to update equipment 🥲',
          message: error.data.message
        })
      }
    } finally {
      isSubmitting.value = false
    }
  }
</script>
