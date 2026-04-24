<template>
  <PerdCard :class="$style.component">
    <div :class="$style.body">
      <FidgetSpinner :class="$style.spinner" />

      <PerdHeading :level="2">
        {{ title }}
      </PerdHeading>

      <p :class="$style.text">
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
    description: string;
    title: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    min-height: min(60vh, 32rem);
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
    font-size: 2rem;
  }

  .text {
    margin: 0;
    max-width: 28rem;
    color: var(--color-text-tertiary);
  }
</style>
