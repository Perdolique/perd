# Vue Components

Use `<script lang="ts" setup>` for all Vue components with strict typing.

## Component Props

```vue
<script lang="ts" setup>
  import type { ChecklistItemModel } from '~/models/checklist'

  interface Props {
    item: ChecklistItemModel;
    checkMode: boolean;
    disabled?: boolean;
  }

  const { checkMode, item, disabled = false } = defineProps<Props>()
</script>
```

## Component Emits

Multiple events with different signatures:

```vue
<script lang="ts" setup>
  interface Props {
    modelValue: string;
  }

  interface Emits {
    (event: 'update:modelValue', value: string): void
    (event: 'change', value: string): void
    (event: 'delete'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  function handleInput(inputEvent: Event) {
    const target = inputEvent.target

    if (target instanceof HTMLInputElement) {
      emit('update:modelValue', target.value)
    }
  }
</script>
```

Multiple events with same signature:

```vue
<script lang="ts" setup>
  type Emits = (event: 'open' | 'close' | 'toggle') => void

  const emit = defineEmits<Emits>()

  function handleOpen() {
    emit('open')
  }
</script>
```

## Using Composables in Components

```vue
<script lang="ts" setup>
  import type { BrandModel } from '~/models/brand'

  interface Props {
    brandId: number;
  }

  const { brandId } = defineProps<Props>()
  // Composables
  const { showErrorToast } = useApiErrorToast()
  const { brands, isLoading, error } = useBrands()

  // Computed
  const currentBrand = computed(() =>
    brands.value.find((brand) => brand.id === brandId)
  )

  // Methods
  async function deleteBrand() {
    try {
      await $fetch(`/api/brands/${brandId}`, { method: 'DELETE' })
      navigateTo('/brands')
    } catch (error) {
      showErrorToast(error, 'Failed to delete brand')
    }
  }
</script>
```

## v-model Pattern

```vue
<template>
  <input v-model="value" type="text" />
</template>

<script lang="ts" setup>
  interface Props {
    modelValue: string;
  }

  type Emits = (event: 'update:modelValue', value: string) => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  // Computed for two-way binding
  const value = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
</script>
```
