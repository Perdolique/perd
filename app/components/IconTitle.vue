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
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    readonly icon: string;
    readonly level: InstanceType<typeof PerdHeading>['level'];
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
    width: 40px;
    height: 40px;
    border-radius: var(--border-radius-12);
    background: var(--secondary-100);
    color: var(--secondary-500);
  }
</style>
