<template>
  <SwitchBase
    as="button"
    role="switch"
    :aria-checked="checked"
    :checked="checked"
    :small="small"
    @click="handleClick"
  />
</template>

<script lang="ts" setup>
  import SwitchBase from './SwitchBase.vue';

  interface Props {
    readonly small?: boolean;
  }

  defineProps<Props>()

  const checked = defineModel<boolean>({
    required: true
  })

  function handleClick() {
    checked.value = !checked.value
  }
</script>
