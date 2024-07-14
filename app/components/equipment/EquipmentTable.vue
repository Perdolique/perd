<template>
  <div :class="$style.table">
      <div :class="$style.tableHead">
        <div :class="[$style.cell, 'id']">
          ID
        </div>

        <div :class="[$style.cell, 'name']">
          Name
        </div>

        <div :class="[$style.cell, 'weight']">
          Weight
        </div>

        <div :class="[$style.cell, 'created']">
          Created
        </div>
      </div>

      <template v-if="hasEquipment">
        <EquipmentRow
          v-for="item in equipment"
          :key="item.id"
          :id="item.id"
          :name="item.name"
          :weight="item.weight"
          :createdAt="item.createdAt"
        />
      </template>

      <div
        v-else
        :class="$style.emptyMessage"
      >
        Start typing or relax filters
      </div>
    </div>
</template>

<script lang="ts" setup>
  export interface EquipmentItem {
    readonly id: string;
    readonly name: string;
    readonly weight: number | null;
    readonly createdAt: string;
  }

  interface Props {
    readonly equipment: EquipmentItem[]
  }

  const props = defineProps<Props>()
  const hasEquipment = computed(() => props.equipment.length > 0)
</script>

<style module>
  .table {
    display: grid;
  }

  .tableHead {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr 1fr;
    font-weight: bold;
  }

  .emptyMessage {
    padding: var(--spacing-24);
    text-align: center;
  }
</style>
