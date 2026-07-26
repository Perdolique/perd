<template>
  <div
    :class="$style.component"
    :style="componentStyle"
    :aria-label="scrollRegionLabel"
    role="region"
    tabindex="0"
  >
    <table :class="$style.table">
      <caption :class="$style.visuallyHidden">
        {{ caption }}
      </caption>

      <colgroup>
        <col :class="$style.propertyColumn">

        <col
          v-for="item in items"
          :key="item.id"
        >
      </colgroup>

      <thead>
        <tr>
          <th :class="[$style.headerCell, $style.cornerCell]" scope="col">
            <span :class="$style.visuallyHidden">Property</span>
          </th>

          <th
            v-for="(item, itemIndex) in items"
            :key="item.id"
            :class="[$style.headerCell, $style.itemHeader]"
            scope="col"
          >
            <div :class="$style.itemHeaderContent">
              <span :class="$style.brand">{{ item.brand.name }}</span>

              <button
                ref="removeButtons"
                type="button"
                :class="$style.removeButton"
                :aria-label="`Remove ${item.brand.name} ${item.name} from comparison`"
                :data-item-id="item.id"
                @click="handleRemove(item.id, itemIndex, $event)"
              >
                <Icon name="hugeicons:cancel-01" aria-hidden="true" />
              </button>

              <PerdLink
                :class="$style.itemName"
                :to="item.detailPath"
                :aria-label="`View ${item.brand.name} ${item.name}`"
              >
                {{ item.name }}
              </PerdLink>
            </div>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <th :class="$style.propertyCell" scope="row">
            {{ row.name }}
          </th>

          <td
            v-for="value in row.values"
            :key="value.itemId"
            :class="$style.valueCell"
          >
            {{ value.displayValue }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
  import type { GearLibraryComparisonRow } from '~/utils/gear-library-comparison'

  interface GearLibraryComparisonTableItemBrand {
    name: string;
  }

  interface GearLibraryComparisonTableItem {
    brand: GearLibraryComparisonTableItemBrand;
    detailPath: string;
    id: string;
    name: string;
  }

  interface GearLibraryComparisonTableProps {
    caption: string;
    items: GearLibraryComparisonTableItem[];
    rows: GearLibraryComparisonRow[];
  }

  export type {
    GearLibraryComparisonTableItem,
    GearLibraryComparisonTableItemBrand,
    GearLibraryComparisonTableProps
  }
</script>

<script lang="ts" setup>
  import { computed, type CSSProperties, useTemplateRef } from 'vue'

  import PerdLink from '~/components/PerdLink.vue'

  interface Emits {
    remove: [itemId: string, focusTargetId?: string];
  }

  const props = defineProps<GearLibraryComparisonTableProps>()
  const emit = defineEmits<Emits>()
  const removeButtons = useTemplateRef('removeButtons')

  const scrollRegionLabel = computed(
    () => `${props.caption}. Scroll horizontally to view all items.`
  )

  const componentStyle = computed<CSSProperties>(() => {
    return {
      '--comparison-item-count': props.items.length
    }
  })

  function handleRemove(itemId: string, itemIndex: number, event: MouseEvent) {
    const shouldRestoreFocus = event.detail === 0
    const focusTarget = props.items[itemIndex + 1] ?? props.items[itemIndex - 1]
    const focusTargetId = shouldRestoreFocus ? focusTarget?.id : undefined

    emit('remove', itemId, focusTargetId)
  }

  function focusRemoveButton(itemId: string) {
    const focusTarget = removeButtons.value?.find(
      (button) => button.dataset.itemId === itemId
    )

    focusTarget?.focus()
  }

  defineExpose({ focusRemoveButton })
</script>

<style module>
  .component {
    --comparison-property-column-size: 9rem;
    --comparison-item-column-min-size: 13rem;
    --comparison-item-column-max-size: 20rem;

    justify-self: start;
    inline-size: min(
      100%,
      calc(
        var(--comparison-property-column-size)
        + (var(--comparison-item-count) * var(--comparison-item-column-max-size))
      )
    );
    max-block-size: min(65dvb, 46rem);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-16);
    overflow: auto;
    overscroll-behavior-inline: contain;
    background-color: var(--color-background-elevated);
    transition:
      inline-size var(--transition-duration-normal) var(--transition-easing-standard);

    &:focus-visible {
      box-shadow: var(--shadow-focus);
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }
  }

  .table {
    inline-size: 100%;
    min-inline-size: calc(
      var(--comparison-property-column-size)
      + (var(--comparison-item-count) * var(--comparison-item-column-min-size))
    );
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
  }

  .headerCell,
  .propertyCell,
  .valueCell {
    padding: var(--spacing-12) var(--spacing-16);
    border-block-end: 1px solid var(--color-border-subtle);
    border-inline-end: 1px solid var(--color-border-subtle);
    background-color: var(--color-background-elevated);
    text-align: start;
    vertical-align: top;
  }

  .propertyColumn {
    inline-size: var(--comparison-property-column-size);
  }

  .headerCell {
    position: sticky;
    z-index: 2;
    inset-block-start: 0;
    min-inline-size: var(--comparison-item-column-min-size);
    background-color: var(--color-surface-secondary);
  }

  .cornerCell,
  .propertyCell {
    /* Keeps the sticky property rail stable while item columns share the remaining width. */
    inline-size: var(--comparison-property-column-size);
    min-inline-size: var(--comparison-property-column-size);
    max-inline-size: var(--comparison-property-column-size);
  }

  .cornerCell {
    z-index: 3;
    inset-inline-start: 0;
  }

  .itemHeaderContent {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    column-gap: var(--spacing-8);
    row-gap: var(--spacing-4);
  }

  .propertyCell {
    position: sticky;
    z-index: 1;
    inset-inline-start: 0;
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
  }

  .valueCell {
    color: var(--color-text-secondary);
  }

  .brand {
    display: block;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-regular);
  }

  .itemName {
    grid-column: 1 / -1;
    min-inline-size: 0;
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
      background-color: var(--color-surface-tertiary);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }
  }

  .visuallyHidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    border: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
