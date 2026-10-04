<template>
  <li :class="$style.component" :data-property-id="property.id">
    <span :class="$style.position">{{ position }}</span>
    <div :class="$style.identity">
      <h2 :class="$style.name">{{ property.name }}</h2>
    </div>
    <span :class="$style.type">{{ typeLabel }}</span>
    <span :class="$style.usage">{{ property.usedItemCount }}<span :class="$style.usageUnit"> items</span></span>
    <div :class="$style.actions">
      <PerdButton size="small" variant="secondary" :disabled="disabled" :aria-label="editLabel" @click="emit('edit', property)">Edit</PerdButton>
      <PerdActionMenu :label="actionsLabel" :menu-label="menuLabel" :items="items" :disabled="disabled" @action="emit('delete', property)" />
    </div>
  </li>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { AdminCategoryProperty } from '#server/utils/equipment/category-properties'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdActionMenu, { type ActionMenuItem } from '~/components/PerdActionMenu.vue'

  interface Props {
    property: AdminCategoryProperty;
    index: number;
    disabled: boolean;
  }

  interface Emits {
    edit: [property: AdminCategoryProperty];
    delete: [property: AdminCategoryProperty];
  }

  const { property, index } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const position = computed(() => index + 1)
  const editLabel = computed(() => `Edit ${property.name}`)
  const actionsLabel = computed(() => `Actions for ${property.name}`)
  const menuLabel = computed(() => `${property.name} actions`)

  const typeLabel = computed(() => {
    if (property.dataType === 'enum') {
      return `Enum · ${property.enumOptions.length} options`
    }

    const firstLetter = property.dataType.charAt(0)
    const capitalizedFirstLetter = firstLetter.toUpperCase()
    const remainingLetters = property.dataType.slice(1)
    const label = capitalizedFirstLetter + remainingLetters

    return property.unit ? `${label} · ${property.unit}` : label
  })

  const items: ActionMenuItem[] = [
    {
      id: 'delete',
      label: 'Delete characteristic',
      icon: 'hugeicons:delete-02',
      danger: true
    }
  ]
</script>

<style module>
  .component {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) minmax(8rem, 1fr) 5rem 7.5rem;
    align-items: center;
    gap: var(--spacing-16);
    padding: var(--spacing-8) var(--spacing-16);
    background: var(--color-surface-primary);
    overflow-wrap: anywhere;

    & + & { border-block-start: 1px solid var(--color-border-subtle); }

    @container (width < 42rem) {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--spacing-4) var(--spacing-12);
    }
  }

  .position, .usage { color: var(--color-text-secondary); font-size: var(--font-size-14); font-variant-numeric: tabular-nums; }
  .identity { min-inline-size: 0; }
  .name { font-size: var(--font-size-14); font-weight: var(--font-weight-medium); }
  .type { justify-self: start; font-size: var(--font-size-14); color: var(--color-text-secondary); }
  .usageUnit { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
  .actions { display: flex; align-items: center; gap: var(--spacing-8); }

  @container (width < 42rem) {
    .position { display: none; }
    .identity { grid-column: 1; grid-row: 1; }
    .type { grid-column: 1; grid-row: 2; }
    .usage { grid-column: 1; grid-row: 3; }
    .usageUnit { position: static; inline-size: auto; block-size: auto; clip-path: none; }
    .actions { grid-column: 2; grid-row: 1 / 4; }
  }
</style>
