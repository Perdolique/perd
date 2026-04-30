<template>
  <PerdCard :class="$style.component">
    <div :class="$style.sectionHeader">
      <IconTitle icon="tabler:list-details" :level="2">
        Properties
      </IconTitle>
    </div>

    <PagePlaceholder v-if="hasNoProperties" emoji="🧰" title="No properties yet.">
      This item does not have any normalized property values yet.
    </PagePlaceholder>

    <dl v-else :class="$style.list">
      <div
        v-for="property in properties"
        :key="property.slug"
        :class="$style.item"
      >
        <dt :class="$style.label">
          {{ property.name }}
        </dt>

        <dd :class="$style.value">
          {{ property.displayValue }}
        </dd>
      </div>
    </dl>
  </PerdCard>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { ItemDisplayProperty } from '~/types/equipment'
  import IconTitle from '~/components/IconTitle.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdCard from '~/components/PerdCard.vue'

  interface Props {
    properties: ItemDisplayProperty[];
  }

  const props = defineProps<Props>()
  const hasNoProperties = computed(() => props.properties.length === 0)
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
    container-type: inline-size;
  }

  .sectionHeader {
    display: flex;
    align-items: center;
  }

  .list {
    display: grid;
    gap: var(--spacing-12);

    @container (inline-size >= 40rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .item {
    display: grid;
    gap: var(--spacing-8);
    padding: var(--spacing-16);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-subtle);
    border: 1px solid var(--color-border-subtle);
  }

  .label {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-label);
  }

  .value {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
  }
</style>
