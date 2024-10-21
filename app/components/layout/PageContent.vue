<template>
  <div :class="$style.layout">
    <div :class="$style.header">
      <PerdHeading
        v-if="pageTitle"
        :class="$style.heading"
        :level="1"
      >
        {{ pageTitle }}
      </PerdHeading>

      <slot name="actions" />
    </div>

    <div>
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    readonly pageTitle: string;
  }

  defineProps<Props>()
</script>

<style lang="scss" module>
  .layout {
    display: grid;
    row-gap: var(--spacing-32);
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-16);
    justify-content: space-between;
    align-items: center;
    overflow: hidden;
  }

  .heading {
    @include overflow-ellipsis();
  }
</style>
