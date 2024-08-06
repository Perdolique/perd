import type { ChecklistItemModel } from "~/models/checklist"

export async function useChecklistItemsData(checklistId: string) {
  const items = ref<ChecklistItemModel[]>([])
  const { data } = await useFetch(`/api/checklists/${checklistId}/items`)

  if (data.value !== undefined) {
    items.value = data.value
  }

  return items
}
