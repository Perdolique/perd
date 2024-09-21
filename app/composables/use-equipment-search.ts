import { useDebounceFn } from '@vueuse/core';
import type { EquipmentItem } from '~/components/equipment/EquipmentTable.vue';

interface EquipmentData {
  readonly id: number;
  readonly name: string | null;
  readonly weight: number;
  readonly createdAt: string;
}

function transformEquipment(data: EquipmentData[]) : EquipmentItem[] {
  if (data === undefined) {
    return []
  }

  return data.map((item) => {
    return {
      id: item.id,
      name: item.name ?? 'N/A',
      weight: item.weight,
      createdAt: item.createdAt
    }
  })
}

export function useEquipmentSearch(searchString: Ref<string>) {
  const equipment = ref<EquipmentItem[]>([])
  const isFetching = ref(false)

  async function findEquipment(search: string) {
    isFetching.value = true

    try {
      const result = await $fetch('/api/equipment', {
        params: {
          searchString: searchString.value
        }
      })

      if (result !== undefined) {
        equipment.value = transformEquipment(result)
      }
    } finally {
      isFetching.value = false
    }

  }

  const debouncedFindEquipment = useDebounceFn(findEquipment, 300)

  watch(searchString, () => {
    debouncedFindEquipment(searchString.value)
  })

  return {
    equipment,
    isFetching
  }
}
