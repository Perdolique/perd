export async function useUserEquipment() {
  const equipment = useUserEquipmentState()
  const { data } = await useFetch('/api/user/equipment')

  async function updateEquipment() {
    try {
      const response = await $fetch('/api/user/equipment')

      equipment.value = response
    } catch {
      console.error('Failed to update equipment')
    }
  }

  if (data.value !== undefined) {
    equipment.value = data.value
  }

  return {
    equipment,
    updateEquipment
  }
}
