interface EquipmentGroup {
  readonly id: number
  readonly name: string
}

export default async function useEquipmentGroupsData() {
  const groups = ref<EquipmentGroup[]>([])

  const sortedGroups = computed(
    () => groups.value.sort((groupA, groupB) => groupA.name.localeCompare(groupB.name))
  )

  const { data } = await useFetch('/api/equipment/groups')

  if (data.value !== undefined) {
    groups.value = data.value
  }

  function addGroup(group: EquipmentGroup) {
    groups.value.push(group)
  }

  return {
    addGroup,
    groups: sortedGroups
  }
}
