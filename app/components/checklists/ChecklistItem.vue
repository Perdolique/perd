<template>
  <div
    :class="[$style.component, { checkMode, toggled: isToggled }]"
    @click="onItemClick"
  >
    <PerdToggle
      v-if="checkMode"
      :model-value="isToggled"
      inert
    />

    <div :class="$style.name">
      {{ item.equipment.name}}
    </div>

    <div
      v-if="isViewMode"
      :class="$style.weight"
    >
      {{ item.equipment.weight }}
    </div>

    <div
      v-if="isViewMode"
      :class="$style.actions"
    >
      <IconButton
        size="xs"
        icon="tabler:x"
        @click="handleRemoveClick"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import type { ChecklistItemModel } from '~/models/checklist'
  import IconButton from '@/components/IconButton.vue'
  import PerdToggle from '@/components/PerdToggle.vue'

  interface Props {
    readonly item: ChecklistItemModel;
    readonly checkMode: boolean;
    readonly checklistId: string;
  }

  const { checkMode, item, checklistId } = defineProps<Props>()
  const { removeItem } = useChecklistStore()
  const isViewMode = computed(() => checkMode === false)
  const { state: toggledState } = useChecklistToggle(checklistId)

  const isToggled = computed(() => {
    if (checkMode) {
      return toggledState.value[item.id] ?? false
    }

    return false
  })

  async function handleRemoveClick() {
    await removeItem(checklistId, item.id)
  }

  function onItemClick() {
    if (checkMode) {
      toggledState.value[item.id] = !isToggled.value
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
    background-color: var(--element-color-background);
    border: 1px solid var(--color-blue-300);
    border-radius: var(--border-radius-12);
    font-size: var(--font-size-16);
    color: var(--color-blue-800);

    &:global(.checkMode) {
      grid-template-columns: auto 1fr;
      cursor: pointer;
      transition: background-color var(--transition-time-quick) ease-out;

      &:hover {
        background-color: var(--element-color-background-hover);
      }
    }

    &:global(.toggled) {
      background-color: var(--element-color-background-active);

      &:hover {
        background-color: var(--element-color-background-active);
      }
    }
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
