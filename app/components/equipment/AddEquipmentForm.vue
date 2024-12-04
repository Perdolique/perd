<template>
  <EmptyState
    v-if="hasError"
    icon="streamline-emojis:face-screaming-in-fear"
  >
    Can't load required data
  </EmptyState>

  <EditEquipmentForm
    v-else
    v-model:name="name"
    v-model:description="description"
    v-model:weight="weight"
    v-model:type-id="typeId"
    v-model:group-id="groupId"
    v-model:brand="brand"
    :groups="groupOptions"
    :types="typeOptions"
    :submitting="isSubmitting"
    save-button-text="Add equipment"
    @submit="onSubmit"
  />
</template>

<script lang="ts" setup>
  import EmptyState from '~/components/EmptyState.vue';
  import EditEquipmentForm, { type Brand } from '~/components/equipment/EditEquipmentForm.vue';

  const name = ref('')
  const description = ref('')
  const weight = ref('')
  const typeId = ref('')
  const groupId = ref('')
  const brand = ref<Brand | null>(null)
  const isSubmitting = ref(false)
  const { addToast } = useToaster()
  const { showErrorToast } = useApiErrorToast()
  const { groups, fetchGroups, hasError: hasGroupsError } = useEquipmentGroupsState()
  const { types, fetchTypes, hasError: hasTypesError } = useEquipmentTypesState()

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

  const hasError = computed(() => hasGroupsError.value || hasTypesError.value)

  await Promise.all([fetchGroups(), fetchTypes()])

  function resetForm() {
    name.value = ''
    description.value = ''
    weight.value = ''
    typeId.value = ''
    groupId.value = '',
    brand.value = null
  }

  async function onSubmit() {
    if (isSubmitting.value) {
      return
    }

    try {
      isSubmitting.value = true

      const descriptionValue = description.value === '' ? undefined : description.value
      const brandId = brand.value === null ? undefined : parseInt(brand.value.value)

      await $fetch('/api/equipment/items', {
        method: 'POST',

        body: {
          brandId,
          description: descriptionValue,
          groupId: parseInt(groupId.value),
          name: name.value,
          typeId: parseInt(typeId.value),
          weight: parseInt(weight.value)
        }
      })

      addToast({
        title: 'Equipment added 🎉',
        message: 'The equipment has been successfully added.'
      })

      resetForm()
    } catch (error) {
      showErrorToast(error, 'Failed to add equipment 🥲')
    } finally {
      isSubmitting.value = false
    }
  }
</script>
