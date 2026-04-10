<template>
  <div
    :class="$style.layout"
    data-testid="page-content"
  >
    <div
      :class="$style.header"
      data-testid="page-content-header"
    >
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
    row-gap: var(--spacing-32);
    container-type: inline-size;
  }

  .header {
    display: grid;
    gap: var(--spacing-16);
    justify-content: space-between;

    @container (width >= 414px) {
      grid-template-columns: 1fr auto;
      align-items: start;
    }
  }

  .heading {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .actions {
    justify-self: start;
    min-width: 0;
  }
</style>
