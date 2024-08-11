<template>
  <div :class="$style.component">
    <div :class="$style.name">
      {{ item.equipment.name}}
    </div>

    <div :class="$style.weight">
      {{ item.equipment.weight }}
    </div>

    <div :class="$style.actions">
      <IconButton
        size="xs"
        icon-name="tabler:x"
        @click="handleRemoveClick"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import type { ChecklistItemModel } from '~/models/checklist';
  import IconButton from '@/components/IconButton.vue';

  interface Props {
    readonly item: ChecklistItemModel;
  }

  const props = defineProps<Props>();
  const route = useRoute();
  const { removeItem } = useChecklistStore();

  async function handleRemoveClick() {
    if (typeof route.params.checklistId === 'string' && typeof props.item.id === 'string') {
      await removeItem(route.params.checklistId, props.item.id);
    }
  }
</script>

<style lang="scss" module>
  .component {
    height: 40px;
    display: grid;
    grid-template-columns: minmax(100px, 30%) auto auto;
    column-gap: var(--spacing-12);
    align-items: center;
    padding: 0 var(--spacing-12);
    background-color: var(--color-blue-100);
    border: 1px solid var(--color-blue-300);
    border-radius: var(--border-radius-12);
    font-size: var(--font-size-16);
    color: var(--color-blue-800);
  }

  .name {
    @include overflow-ellipsis();
  }

  .weight {
    color: var(--color-blue-700);
    font-size: var(--font-size-14);
  }

  .actions {
    justify-self: end;
  }

  .icon {
    display: block;
    cursor: pointer;
  }
</style>
