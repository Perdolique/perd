<template>
  <div
    :class="$style.component"
    data-testid="page-content"
  >
    <div
      :class="$style.header"
      data-testid="page-content-header"
    >
      <div :class="$style.headingBlock">
        <PerdHeading
          v-if="pageTitle"
          :class="$style.heading"
          :level="1"
        >
          {{ pageTitle }}
        </PerdHeading>
      </div>

      <div
        v-if="$slots.actions"
        :class="$style.actions"
        data-testid="page-content-actions"
      >
        <slot name="actions" />
      </div>
    </div>

    <div>
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    pageTitle?: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    row-gap: var(--spacing-24);
    container-type: inline-size;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: var(--spacing-16);
    padding-block-end: var(--spacing-16);
    border-block-end: 1px solid var(--color-border-subtle);
  }

  .headingBlock {
    min-inline-size: 0;
  }

  .heading {
    text-wrap: balance;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);
    align-items: center;
  }
</style>
