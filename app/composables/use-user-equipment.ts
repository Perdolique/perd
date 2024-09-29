interface EquipmentItem {
  readonly id: number;
  readonly name: string;
  readonly weight: number;
  readonly createdAt: string;
}

export async function useUserEquipment() {
  const equipment = useState<EquipmentItem[]>('userEquipment', () => [])

  const { data } = await useFetch('/api/inventory')

  async function refetchEquipment() {
    try {
      const response = await $fetch('/api/inventory')

      equipment.value = response
    } catch {
      // TODO: Handle error
      console.error('Failed to update equipment')
    }
  }

  if (data.value !== undefined) {
    equipment.value = data.value
  }

  return {
    equipment,
    refetchEquipment
  }
}
