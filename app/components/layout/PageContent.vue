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

      <div
        v-if="$slots.actions"
        :class="$style.actions"
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
    row-gap: var(--spacing-32);
  }

  .header {
    display: grid;
    gap: var(--spacing-16);
    justify-content: space-between;

    @media (width >= 414px) {
      grid-template-columns: 1fr auto;
    }
  }

  .heading {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions {
    justify-self: start;
  }
</style>
