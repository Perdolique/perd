import { useLocalStorage } from '@vueuse/core'

export default function useChecklistToggle(checklistId: string) {
  const state = useLocalStorage<Record<string, boolean>>(`toggled:${checklistId}`, {})

  function resetAll() {
    state.value = {}
  }

  return {
    state,
    resetAll
  }
}
