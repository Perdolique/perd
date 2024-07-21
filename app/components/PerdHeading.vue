<template>
  <component
    :is="element.name"
    :class="[$style.component, element.className]"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
  interface Props {
    readonly level: 1;
  }

  const props = defineProps<Props>();

  const element = computed(() => {
    switch (props.level) {
      case 1: {
        return {
          name: 'h1',
          className: 'h1'
        };
      }
    }
  });
</script>

<style module>
  .component {
    padding: 0;
    margin: 0;

    &:global(.h1) {
      font-size: var(--font-size-24);
      font-weight: var(--font-weight-bold);
    }
  }
</style>
