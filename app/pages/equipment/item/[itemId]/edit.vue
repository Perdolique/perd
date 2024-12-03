<template>
  <PageContent page-title="Edit equipment item">
    <EditEquipmentForm
      v-if="data"
      v-model:name="name"
      v-model:description="description"
      v-model:weight="weight"
      v-model:type-id="typeId"
      v-model:group-id="groupId"
      v-model:brand="brand"
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
  import EditEquipmentForm, { type Brand } from '~/components/equipment/EditEquipmentForm.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import EmptyState from '~/components/EmptyState.vue'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const route = useRoute()
  const router = useRouter()
  const isSubmitting = ref(false)
  const { addToast } = useToaster()
  const { showErrorToast } = useApiErrorToast()

  // TODO: create an utility function
  const itemId = route.params.itemId?.toString() ?? ''
  const brand = ref<Brand | null>(null)

  // TODO: use useAsyncData
  const { data, error } = await useFetch(`/api/equipment/items/${itemId}`)
  const { groups, fetchGroups } = useEquipmentGroupsState()
  const { types, fetchTypes } = useEquipmentTypesState()

  await Promise.all([fetchGroups(), fetchTypes()])

  const name = ref(data.value?.equipment.name ?? '')
  const description = ref(data.value?.equipment.description ?? '')
  const weight = ref(data.value?.equipment.weight.toString() ?? '')
  const typeId = ref(data.value?.group?.id.toString() ?? '')
  const groupId = ref(data.value?.type?.id.toString() ?? '')

  if (data.value !== undefined && data.value.brand !== null) {
    brand.value = {
      label: data.value.brand.name,
      value: data.value.brand.id.toString()
    }
  }

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
      return `Item with ID ${itemId} not found`
    }

    return 'Something went wrong'
  })

  async function onSubmit() {
    if (isSubmitting.value) {
      return
    }

    try {
      isSubmitting.value = true

      const brandId = brand.value?.value === undefined ? null : parseInt(brand.value?.value)

      await $fetch(`/api/equipment/items/${itemId}`, {
        method: 'PATCH',

        body: {
          brandId,
          description: description.value,
          groupId: parseInt(groupId.value),
          name: name.value,
          typeId: parseInt(typeId.value),
          weight: parseInt(weight.value)
        }
      })

      addToast({
        title: 'Equipment updated 🎉',
        message: 'The equipment has been successfully updated'
      })

      router.push(`/equipment/item/${itemId}`)
    } catch (error) {
      showErrorToast(error, 'Failed to update equipment 🥲')
    } finally {
      isSubmitting.value = false
    }
  }
</script>
