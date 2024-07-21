<template>
  <div :class="$style.component">
    <nav :class="$style.header">
      <PerdLink to="/manager/equipment/add">
        Add Item
      </PerdLink>
    </nav>

    <PerdInput
      v-model="searchString"
      autofocus
      placeholder="MGS Bubba Hubba UL2"
      label="Search"
      autocomplete="off"
    />
  </div>

  <ol>
    <li
      v-for="item in equipment"
      :key="item.id"
    >
      {{ item.name }}
    </li>
  </ol>
</template>

<script lang="ts" setup>
  import PerdInput from '~/components/PerdInput.vue';
  import PerdLink from '~/components/PerdLink.vue';

  definePageMeta({
    middleware: ['admin'],
    title: 'Equipment manager'
  })

  const searchString = ref('')
  const { equipment } = useEquipmentSearch(searchString)
</script>

<style module>
  .component {
    display: grid;
    row-gap: var(--spacing-16);
  }

  .header {
    display: flex;
    justify-content: space-between;
    width: 100%;
  }
</style>
