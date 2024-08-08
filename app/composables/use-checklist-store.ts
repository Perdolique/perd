import type { ChecklistItemModel } from "~/models/checklist";

export function useChecklistStore() {
  const items = useState<ChecklistItemModel[]>('checklistItems', () => [])

  async function removeItem(checklistId: string, itemId: string) {
    try {
      const deletedItem = await $fetch(`/api/checklists/${checklistId}/items/${itemId}`, {
        method: 'DELETE'
      });

      items.value = items.value.filter(item => item.id !== deletedItem.id);
    } catch (error) {
      console.error(error);
    }
  }

  async function addItem(checklistId: string, equipmentId: string) {
    try {
      const insertedItem = await $fetch(`/api/checklists/${checklistId}/items`, {
        method: 'POST',

        body: {
          equipmentId
        }
      });

      if (insertedItem !== undefined) {
        items.value.push({
          id: insertedItem.id,
          equipment: insertedItem.equipment
        })
      }
    } catch (error) {
      console.error(error);
    }
  }

  return {
    items,
    removeItem,
    addItem
  }
}
