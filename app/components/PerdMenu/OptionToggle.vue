<template>
  <OptionBase @click.stop="handleClick">
    <template #icon>
      <SwitchBase
        small
        :checked="model"
        :class="$style.switch"
        inert
      />
    </template>

    <slot />
  </OptionBase>
</template>

<script lang="ts" setup>
  import SwitchBase from '@/components/SwitchBase.vue';
  import OptionBase from './OptionBase.vue';

  const model = defineModel<boolean>({
    required: true
  })

  function handleClick() {
    model.value = !model.value;
  }
</script>

<style module>
  .switch {
    pointer-events: none;
  }
</style>
