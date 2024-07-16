<template>
  <div :class="$style.component">
    <nav :class="$style.header">
      <PerdLink to="/manager/equipment/add">
        Add Item
      </PerdLink>
    </nav>

    <hr :class="$style.divider" />

    <PerdInput
      v-model="searchString"
      autofocus
      placeholder="MGS Bubba Hubba UL2"
      label="Search"
      autocomplete="off"
    />

    <EquipmentTable :equipment="equipment" />
  </div>
</template>

<script lang="ts" setup>
  definePageMeta({
    middleware: ['admin']
  })

  const searchString = ref('')
  const { equipment, isFetching } = useEquipmentSearch(searchString)
</script>

<style module>
  .component {
    display: grid;
    row-gap: var(--spacing-24);
    padding: var(--spacing-16);
  }

  .header {
    display: flex;
    justify-content: space-between;
    width: 100%;
  }

  .divider {
    margin: 0;
    width: 100%;
    height: 1px;
    border: none;
    background-color: var(--color-blue-900);
    opacity: 0.5;;
  }
</style>
