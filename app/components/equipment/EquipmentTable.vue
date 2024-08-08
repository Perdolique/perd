<template>
  <div :class="$style.component">
    <table :class="$style.table">
      <thead
        v-if="hasItems"
        :class="$style.header"
      >
        <tr :class="$style.row">
          <th :class="[$style.cell, 'name']">
            Name
          </th>

          <th :class="[$style.cell, 'weight']">
            Weight
          </th>

          <th :class="[$style.cell, 'actions']" />
        </tr>
      </thead>

      <tbody :class="$style.body">
        <template v-if="hasItems">
          <tr
            v-for="item in props.equipment"
            :key="item.id"
            :class="$style.row"
          >
            <td :class="[$style.cell, 'name']">
              {{ item.name }}
            </td>

            <td :class="[$style.cell, 'weight']">
              {{ item.weight }}
            </td>

            <td :class="[$style.cell, 'actions']">
              <div :class="$style.action">
                <PerdButton
                  small
                  secondary
                  icon-name="tabler:trash"
                  @click="removeItem(item)"
                >
                  Retire
                </PerdButton>
              </div>
            </td>
          </tr>
        </template>

        <template v-else>
          <tr>
            <td colspan="3">
              <EmptyContent />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts" setup generic="Item extends EquipmentItem">
  import PerdButton from '~/components/PerdButton.vue';
  import EmptyContent from './EmptyContent.vue';

  export interface EquipmentItem {
    readonly id: string;
    readonly name: string;
    readonly weight: number;
  }

  interface Props {
    readonly equipment: Item[]
  }

  type Emits = (event: 'remove', item: Item) => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const hasItems = computed(() => props.equipment.length > 0)

  async function removeItem(item: Item) {
    emit('remove', item)
  }
</script>

<style lang="scss" module>
  .component {
    border: 1px solid var(--input-color-main);
    border-radius: var(--border-radius-16);
    overflow: hidden;
  }

  .table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    overflow: hidden;
  }

  .header {
    background-color: var(--input-color-main);
    color: var(--color-white);
  }

  .row {
    height: 48px;

    .body > & {
      transition: background-color 0.2s ease-out;

      &:hover {
        background-color: #e5e5e5;
      }
    }
  }

  .cell {
    text-align: left;
    padding: 0 var(--spacing-16);

    .header & {
      font-weight: var(--font-weight-medium);
    }

    &:global(.name) {
      @include overflow-ellipsis();
    }

    &:global(.actions) {
      width: 8rem;
    }
  }

  .action {
    display: none;
    opacity: 0;
    transition:
      opacity 0.2s ease-out,
      display 0.2s ease-out allow-discrete;

    .row:hover & {
      display: inherit;
      opacity: 1;

      @starting-style {
        opacity: 0;
      }
    }
  }
</style>
