<template>
  <div
    :class="$style.layout"
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
  .layout {
    display: grid;
    row-gap: var(--spacing-24);
    container-type: inline-size;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: var(--spacing-16);
    padding-bottom: var(--spacing-16);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .headingBlock {
    min-width: 0;
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
