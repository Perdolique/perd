# Composables

## Basic Composable Structure

```typescript
// composables/use-brands.ts
import type { BrandModel } from '~/models/brand'

export default function useBrands() {
  const brands = useState<BrandModel[]>('brands', () => [])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  async function fetchBrands() {
    try {
      isLoading.value = true
      error.value = null

      const data = await $fetch<BrandModel[]>('/api/brands')

      brands.value = data
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        error.value = caughtError
      }

      console.error(caughtError)
    } finally {
      isLoading.value = false
    }
  }

  return {
    brands,
    isLoading,
    error,
    fetchBrands
  }
}
```

## Composable with Store Pattern

```typescript
// composables/use-checklist-store.ts
import type { ChecklistItemModel } from '~/models/checklist'

export default function useChecklistStore() {
  const items = useState<ChecklistItemModel[]>('checklist-items', () => [])

  function addItem(item: ChecklistItemModel) {
    items.value.push(item)
  }

  function removeItem(id: string) {
    const index = items.value.findIndex((item) => item.id === id)

    if (index !== -1) {
      items.value.splice(index, 1)
    }
  }

  function updateItem(id: string, updates: Partial<ChecklistItemModel>) {
    const index = items.value.findIndex((item) => item.id === id)

    if (index !== -1) {
      items.value[index] = { ...items.value[index], ...updates }
    }
  }

  return {
    items: readonly(items),
    addItem,
    removeItem,
    updateItem
  }
}
```

## Best Practices

- Named functions (not arrow functions) for composable exports
- Use `useState` for cross-component state
- Use `readonly()` from Vue for runtime immutability when needed
- Explicit return types on exported functions
