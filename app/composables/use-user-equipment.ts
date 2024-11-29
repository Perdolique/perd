interface EquipmentItem {
  readonly id: number;
  readonly name: string;
  readonly weight: number;
  readonly createdAt: string;
}

export async function useUserEquipment() {
  const { data, refresh } = await useFetch('/api/inventory', {
    default() {
      return []
    },

    transform(data) {
      return data.map((item) => ({
        id: item.id,
        name: item.name,
        weight: item.weight,
        createdAt: item.createdAt
      }))
    }
  })

  return {
    equipment: data,
    refetchEquipment: refresh
  }
}
