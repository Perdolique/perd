interface EquipmentGroup {
  readonly id: number
  readonly name: string
}

export default function useEquipmentGroupsState() {
  const groupsState = useState<EquipmentGroup[]>('equipmentGroups', () => [])
  const hasError = useState('equipmentGroupsError', () => false)

  const sortedGroups = computed(
    () => groupsState.value.sort((groupA, groupB) => groupA.name.localeCompare(groupB.name))
  )


  async function fetchGroups() {
    const { data, error } = await useFetch('/api/equipment/groups')

    if (data.value !== undefined) {
      groupsState.value = data.value
    }

    if (error.value !== undefined) {
      hasError.value = true
    } else {
      hasError.value = false
    }
  }

  function addGroup(group: EquipmentGroup) {
    groupsState.value.push(group)
  }

  return {
    addGroup,
    fetchGroups,
    hasError,
    groups: sortedGroups
  }
}
