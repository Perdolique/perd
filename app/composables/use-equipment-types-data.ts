interface EquipmentType {
  readonly id: number
  readonly name: string
}

export default async function useEquipmentTypesData() {
  const types = ref<EquipmentType[]>([])

  const sortedTypes = computed(
    () => types.value.sort((typeA, typeB) => typeA.name.localeCompare(typeB.name))
  )

  const { data } = await useFetch('/api/equipment/type')

  if (data.value !== undefined) {
    types.value = data.value
  }

  function addType(type: EquipmentType) {
    types.value.push(type)
  }

  return {
    addType,
    types: sortedTypes
  }
}
