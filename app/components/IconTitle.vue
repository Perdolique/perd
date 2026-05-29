<template>
  <div :class="$style.component">
    <div :class="$style.iconWrapper">
      <Icon
        :name="icon"
        size="20px"
      />
    </div>

    <PerdHeading :level="level">
      <slot />
    </PerdHeading>
  </div>
</template>

<script lang="ts" setup>
  import PerdHeading, { type HeadingLevel } from '~/components/PerdHeading.vue'

  interface Props {
    icon: string;
    level: HeadingLevel;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: flex;
    align-items: center;
    column-gap: var(--spacing-12);
  }

  .iconWrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--layout-touch-target);
    block-size: var(--layout-touch-target);
    border-radius: var(--border-radius-14);
    background: var(--color-accent-subtle);
    color: var(--color-accent-primary);
  }
</style>
