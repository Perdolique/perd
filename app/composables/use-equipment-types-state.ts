interface EquipmentType {
  readonly id: number
  readonly name: string
}

export default function useEquipmentTypesState() {
  const typesState = useState<EquipmentType[]>('equipmentTypes', () => [])
  const hasError = useState('equipmentTypesError', () => false)

  const sortedTypes = computed(
    () => typesState.value.sort((typeA, typeB) => typeA.name.localeCompare(typeB.name))
  )


  async function fetchTypes() {
    const { data, error } = await useFetch('/api/equipment/types')

    if (data.value !== undefined) {
      typesState.value = data.value
    }

    if (error.value !== undefined) {
      hasError.value = true
    } else {
      hasError.value = false
    }
  }

  function addType(type: EquipmentType) {
    typesState.value.push(type)
  }

  return {
    addType,
    fetchTypes,
    hasError,
    types: sortedTypes
  }
}
