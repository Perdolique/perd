<template>
  <PerdCard :class="$style.component">
    <div :class="$style.body">
      <FidgetSpinner :class="$style.spinner" />

      <PerdHeading :level="2">
        {{ title }}
      </PerdHeading>

      <p v-if="description" :class="$style.text">
        {{ description }}
      </p>
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    description?: string;
    title: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    min-block-size: 14rem;
    display: grid;
    place-items: center;
  }

  .body {
    display: grid;
    gap: var(--spacing-16);
    justify-items: center;
    text-align: center;
  }

  .spinner {
    font-size: 1.75rem;
    color: var(--color-accent-primary);
  }

  .text {
    margin: 0;
    max-inline-size: 28rem;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-14);
  }
</style>
