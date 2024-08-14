<template>
  <OptionBase>
    <template #icon>
      <Icon
        :name="icon"
        size="1.125em"
      />
    </template>

    <slot />
  </OptionBase>
</template>

<script lang="ts" setup>
  import OptionBase from './OptionBase.vue';

  interface Props {
    readonly icon: string;
  }

  defineProps<Props>()
</script>
