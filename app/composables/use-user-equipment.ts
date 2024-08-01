interface EquipmentItem {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  readonly createdAt: string;
}

export async function useUserEquipment() {
  const equipment = useState<EquipmentItem[]>('userEquipment', () => [])

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
