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
    :groups="groupOptions"
    :types="typeOptions"
    :submitting="isSubmitting"
    save-button-text="Add equipment"
    @submit="onSubmit"
  />
</template>

<script lang="ts" setup>
  import { FetchError } from 'ofetch';
  import EmptyState from '~/components/EmptyState.vue';
  import EditEquipmentForm from '~/components/equipment/EditEquipmentForm.vue';

  const name = ref('')
  const description = ref('')
  const weight = ref('')
  const typeId = ref('')
  const groupId = ref('')
  const isSubmitting = ref(false)
  const { addToast } = useToaster()
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
    groupId.value = ''
  }

  async function onSubmit() {
    if (isSubmitting.value) {
      return
    }

    try {
      isSubmitting.value = true

      const descriptionValue = description.value === '' ? undefined : description.value

      await $fetch('/api/equipment/items', {
        method: 'POST',

        body: {
          name: name.value,
          description: descriptionValue,
          weight: parseInt(weight.value),
          typeId: parseInt(typeId.value),
          groupId: parseInt(groupId.value)
        }
      })

      addToast({
        title: 'Equipment added 🎉',
        message: 'The equipment has been successfully added.'
      })

      resetForm()
    } catch (error) {
      if (error instanceof FetchError) {
        addToast({
          title: 'Failed to add equipment 🥲',
          message: error.data.message
        })
      }
    } finally {
      isSubmitting.value = false
    }
  }
</script>
