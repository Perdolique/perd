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
    readonly pageTitle?: string;
  }

  defineProps<Props>()
</script>

<style lang="scss" module>
  .layout {
    display: grid;
    row-gap: var(--spacing-32);
  }

  .header {
    display: grid;
    gap: var(--spacing-16);
    justify-content: space-between;

    @include mobileLarge {
      grid-template-columns: 1fr auto;
    }
  }

  .heading {
    @include overflow-ellipsis();
  }

  .actions {
    justify-self: start;
  }
</style>
