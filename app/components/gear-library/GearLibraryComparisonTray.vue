<template>
  <div :class="$style.component" :style="componentStyle">
    <aside
      :class="$style.tray"
      aria-labelledby="gear-library-comparison-heading"
      data-testid="gear-library-comparison-tray"
    >
      <div ref="surface" :class="$style.surface">
        <p
          v-if="announcement"
          :class="$style.notice"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ announcement }}
        </p>

        <p
          v-if="limitAnnouncement"
          :class="$style.notice"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ limitAnnouncement }}
        </p>

        <header :class="$style.header">
          <div>
            <PerdHeading id="gear-library-comparison-heading" :level="2">
              Compare items
            </PerdHeading>

            <div :class="$style.count">
              {{ selectionCountText }}
            </div>

            <div v-if="hasNoItems" :class="$style.helper">
              Select 2 to 4 items
            </div>
          </div>

          <div v-if="hasItems" :class="$style.actions">
            <PerdButton
              v-if="hasRestoreErrors"
              size="small"
              variant="secondary"
              @click="emit('retry')"
            >
              Retry selected items
            </PerdButton>

            <PerdButton
              :class="$style.toggleButton"
              :aria-controls="itemListId"
              :aria-expanded="isItemListExpanded"
              :icon-right="isItemListExpanded
                ? 'hugeicons:arrow-up-01'
                : 'hugeicons:arrow-down-01'"
              size="small"
              variant="ghost"
              @click="isItemListExpanded = !isItemListExpanded"
            >
              {{ isItemListExpanded ? 'Hide items' : 'Show items' }}
            </PerdButton>
          </div>
        </header>

        <ol
          v-if="hasItems"
          :id="itemListId"
          :class="[$style.list, { isExpanded: isItemListExpanded }]"
          role="list"
        >
          <li
            v-for="(item, itemIndex) in displayItems"
            :key="item.id"
            :class="$style.item"
          >
            <div :class="$style.summary">
              <template v-if="item.isResolved">
                <span :class="$style.itemName">{{ item.name }}</span>
                <span :class="$style.itemBrand">{{ item.brandName }}</span>
              </template>

              <span v-else-if="item.isLoading" :class="$style.pending">
                Loading selected item…
              </span>

              <span v-else :class="$style.error">
                Could not load selected item.
              </span>
            </div>

            <button
              ref="removeButtons"
              type="button"
              :class="$style.removeButton"
              :aria-label="item.removeLabel"
              :data-item-id="item.id"
              @click="handleRemove(item.id, itemIndex, $event)"
            >
              <Icon name="hugeicons:cancel-01" aria-hidden="true" />
            </button>
          </li>
        </ol>
      </div>
    </aside>
  </div>
</template>

<script lang="ts" setup>
  import {
    computed,
    nextTick,
    ref,
    useId,
    useTemplateRef,
    watch,
    type CSSProperties
  } from 'vue'

  import { useElementSize } from '@vueuse/core'
  import type { GearLibraryComparisonSelectionItem } from '~/types/equipment'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    announcement: string;
    hasRestoreErrors: boolean;
    items: GearLibraryComparisonSelectionItem[];
    limitAnnouncement: string;
  }

  interface Emits {
    remove: [id: string, restoreFocus: boolean];
    retry: [];
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isItemListExpanded = ref(false)
  const pendingFocusTarget = ref<string>()
  const itemListId = useId()
  const removeButtons = useTemplateRef('removeButtons')
  const surface = useTemplateRef('surface')

  const { height: surfaceHeight } = useElementSize(surface, undefined, {
    box: 'border-box'
  })

  const hasItems = computed(() => props.items.length > 0)
  const hasNoItems = computed(() => hasItems.value === false)
  const selectedItemIds = computed(() => props.items.map((item) => item.id))
  const selectionCountText = computed(() => `${props.items.length} of 4 selected`)

  const componentStyle = computed<CSSProperties>(() => {
    return {
      '--comparison-tray-block-size': `${surfaceHeight.value}px`
    }
  })

  const displayItems = computed(() => props.items.map((item, index) => {
    const position = index + 1
    const isResolved = item.status === 'resolved'
    const isLoading = item.status === 'loading'

    const removeLabel = isResolved
      ? `Remove ${item.name} from comparison`
      : `Remove selected item ${position} from comparison`

    return {
      brandName: item.brandName,
      id: item.id,
      isLoading,
      isResolved,
      name: item.name,
      removeLabel
    }
  }))

  function handleRemove(id: string, index: number, event: MouseEvent) {
    const restoreFocus = event.detail === 0
    const focusTarget = props.items[index + 1] ?? props.items[index - 1]

    pendingFocusTarget.value = restoreFocus ? focusTarget?.id : undefined

    emit('remove', id, restoreFocus)
  }

  watch(selectedItemIds, async () => {
    const focusTarget = pendingFocusTarget.value

    if (focusTarget === undefined) {
      return
    }

    pendingFocusTarget.value = undefined

    await nextTick()

    const nextButton = removeButtons.value?.find(
      (button) => button.dataset.itemId === focusTarget
    )

    nextButton?.focus()
  })
</script>

<style module>
  .component {
    block-size: calc(var(--comparison-tray-block-size) + var(--layout-safe-bottom));

    @media (width >= 900px) {
      block-size: var(--comparison-tray-block-size);
    }
  }

  .tray {
    position: fixed;
    z-index: calc(var(--z-index-shell-dock) - 1);
    inset-inline: var(--spacing-16);
    inset-block-end: calc(var(--layout-dock-height) + var(--layout-safe-bottom) + var(--spacing-8));
    container-type: inline-size;

    @media (width >= 900px) {
      inset-inline-start: calc(var(--layout-sidebar-width) + ((100dvw - var(--layout-sidebar-width)) / 2));
      inset-inline-end: auto;
      inset-block-end: var(--spacing-24);
      inline-size: min(
        calc(100dvw - var(--layout-sidebar-width) - (2 * var(--spacing-24))),
        var(--layout-content-max-width)
      );
      translate: -50% 0;
    }
  }

  .surface {
    display: grid;
    gap: var(--spacing-12);
    max-block-size: calc(100dvb - var(--layout-dock-height) - var(--layout-safe-bottom) - var(--spacing-32));
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-20);
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    background: color-mix(in oklch, var(--color-background-elevated) 94%, transparent);
    box-shadow: var(--shadow-large);
    backdrop-filter: blur(12px);

    @media (width >= 900px) {
      max-block-size: calc(100dvb - var(--spacing-48));
    }
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-8);
  }

  .toggleButton {
    @media (width >= 900px) {
      display: none;
    }
  }

  .notice {
    padding: var(--spacing-8) var(--spacing-12);
    border: 1px solid var(--color-info-primary);
    border-radius: var(--border-radius-10);
    background-color: var(--color-info-subtle);
    color: var(--color-text-primary);
    font-size: var(--font-size-14);
  }

  .count {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
  }

  .helper {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
  }

  .list {
    display: none;
    gap: var(--spacing-8);
    padding: 0;
    list-style-position: inside;

    &:global(.isExpanded) {
      display: grid;
    }

    @media (width >= 900px) {
      display: grid;

      @container (inline-size >= 34rem) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      @container (inline-size >= 60rem) {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
  }

  .item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-8);
    min-block-size: var(--layout-touch-target);
    padding: var(--spacing-8) var(--spacing-8) var(--spacing-8) var(--spacing-12);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-12);
    background-color: var(--color-surface-primary);
  }

  .summary {
    display: grid;
    min-inline-size: 0;
  }

  .itemName {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-14);
  }

  .itemBrand,
  .pending {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
  }

  .error {
    color: var(--color-danger-primary);
    font-size: var(--font-size-12);
  }

  .removeButton {
    display: grid;
    place-items: center;
    inline-size: var(--layout-touch-target);
    block-size: var(--layout-touch-target);
    padding: 0;
    border: 0;
    border-radius: var(--border-radius-10);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--font-size-20);

    &:hover {
      background-color: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }
  }
</style>
