<template>
  <PerdCard :class="$style.component" :data-gear-id="myGearRow.id">
    <div :class="$style.header">
      <div :class="$style.info">
        <div :class="$style.titleRow">
          <span :class="$style.icon" aria-hidden="true">
            <Icon name="hugeicons:backpack-03" />
          </span>

          <div :class="$style.titleBlock">
            <template v-if="catalogItem">
              <div :class="$style.brand">
                {{ catalogItem.brand.name }}
              </div>

              <PerdLink :to="gearLibraryLocation">
                {{ catalogItem.name }}
              </PerdLink>
            </template>
            <span v-else :class="$style.customName">{{ name }}</span>
          </div>
        </div>

        <div :class="$style.tags">
          <template v-if="catalogItem">
            <PerdPill>
              {{ catalogItem.brand.name }}
            </PerdPill>

            <PerdPill>
              {{ catalogItem.category.name }}
            </PerdPill>
          </template>
          <PerdPill v-else>Custom</PerdPill>

          <span :class="$style.meta">
            Added <time :datetime="myGearRow.createdAt">{{ myGearRow.formattedCreatedAt }}</time>
          </span>
        </div>
      </div>

      <PerdActionMenu
        ref="actionMenu"
        :label="actionsLabel"
        :menu-label="menuLabel"
        :items="actions"
        :disabled="myGearRow.isRemoveDisabled"
        :loading="myGearRow.isRemoving"
        @action="handleAction"
      />
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import { computed, useTemplateRef } from 'vue'
  import { createGearLibraryItemLocation } from '~/utils/navigation'
  import type { MyGearRecordView } from '~/types/equipment'
  import PerdActionMenu, { type ActionMenuItem } from '~/components/PerdActionMenu.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PerdPill from '~/components/PerdPill.vue'

  interface Props {
    myGearRow: MyGearRecordView;
  }

  type Emits = (event: 'remove' | 'rename', myGearId: string) => void

  const { myGearRow } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const actionMenu = useTemplateRef('actionMenu')
  const id = computed(() => myGearRow.id)
  const catalogItem = computed(() => myGearRow.source === 'catalog' ? myGearRow.item : null)
  const name = computed(() => myGearRow.source === 'custom' ? myGearRow.customName : myGearRow.item.name)
  const actionsLabel = computed(() => `Actions for ${name.value}`)
  const menuLabel = computed(() => `${name.value} actions`)

  const actions = computed<ActionMenuItem[]>(() => {
    const items: ActionMenuItem[] = []

    if (myGearRow.source === 'custom') {
      items.push({
        id: 'rename',
        label: 'Rename',
        icon: 'hugeicons:pencil-edit-02'
      })
    }

    items.push({
      id: 'remove',
      label: 'Remove',
      icon: 'hugeicons:delete-02',
      danger: true,
      separator: myGearRow.source === 'custom'
    })

    return items
  })

  const gearLibraryLocation = computed(() => myGearRow.source === 'catalog'
    ? createGearLibraryItemLocation(myGearRow.item.id)
    : '')

  function focus() {
    actionMenu.value?.focus()
  }

  defineExpose({
    focus,
    id
  })

  function handleAction(action: string) {
    if (myGearRow.isRemoveDisabled || myGearRow.isRemoving) {
      return
    }

    if (action === 'rename' || action === 'remove') {
      emit(action, myGearRow.id)
    }
  }
</script>

<style module>
  .component {
    display: grid;
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-accent-primary), transparent 94%),
        var(--color-surface-primary)
      );
  }

  .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--spacing-12);
  }

  .info {
    display: grid;
    gap: var(--spacing-8);
  }

  .titleRow {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
  }

  .titleBlock {
    min-inline-size: 0;
    display: grid;
    gap: 0.12rem;
  }

  .customName {
    overflow-wrap: anywhere;
  }

  .brand {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--border-radius-16);
    background-color: var(--color-accent-subtle);
    color: var(--color-accent-primary);
    font-size: 1.1rem;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-8) var(--spacing-12);
  }

  .meta {
    color: var(--color-text-tertiary);
  }
</style>
