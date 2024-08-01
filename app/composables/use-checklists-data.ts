export interface ChecklistModel {
  readonly id: string;
  readonly name: string;
}

export async function useChecklistsData() {
  const checklists = useState<ChecklistModel[]>('checklists', () => [])
  const { data } = await useFetch('/api/checklists')

  if (data.value !== undefined) {
    checklists.value = data.value
  }

  async function fetchChecklists() {
    try {
      const response = await $fetch('/api/checklists')

      checklists.value = response
    } catch {
      console.error('Failed to get checklists data')
    }
  }

  return {
    checklists,
    fetchChecklists
  }
}
