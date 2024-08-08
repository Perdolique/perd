export async function useChecklistItemsData(checklistId: string) {
  const { items } = useChecklistStore()
  const { data } = await useFetch(`/api/checklists/${checklistId}/items`)

  if (data.value !== undefined) {
    items.value = data.value
  }
}
