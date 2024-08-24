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
        icon-name="tabler:x"
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

  const props = defineProps<Props>()
  const { removeItem } = useChecklistStore()
  const isViewMode = computed(() => props.checkMode === false)
  const { state: toggledState } = useChecklistToggle(props.checklistId)

  const isToggled = computed(() => {
    if (props.checkMode) {
      return toggledState.value[props.item.id] ?? false
    }

    return false
  })

  async function handleRemoveClick() {
    await removeItem(props.checklistId, props.item.id)
  }

  function onItemClick() {
    if (props.checkMode) {
      toggledState.value[props.item.id] = !isToggled.value
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
