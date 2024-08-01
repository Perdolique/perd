<template>
  <div :class="$style.layout">
    <PerdHeading
      v-if="pageTitle"
      :class="$style.heading"
      :level="1"
    >
      {{ pageTitle }}
    </PerdHeading>

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

<style module>
  .layout {
    display: grid;
    row-gap: var(--spacing-32);
  }

  .heading {
    overflow: hidden;
    text-overflow: ellipsis;
    text-wrap: nowrap;
  }
</style>
