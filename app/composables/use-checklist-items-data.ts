interface EquipmentItem {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

interface ChecklistItem {
  readonly id: string;
  readonly equipment: EquipmentItem;
}

export async function useChecklistItemsData(checklistId: string) {
  const items = ref<ChecklistItem[]>([])
  const { data } = await useFetch(`/api/checklists/${checklistId}/items`)

  if (data.value !== undefined) {
    items.value = data.value
  }

  async function updateItems() {
    try {
      const response = await $fetch(`/api/checklists/${checklistId}/items`)

      items.value = response
    } catch {
      console.error('Failed to update equipment')
    }
  }

  return {
    items,
    updateItems
  }
}
