<template>
  <div
    :class="$style.component"
    @click="handleClick"
  >
    {{ displayValue }}
  </div>
</template>

<script lang="ts" setup generic="Option">
  interface Props {
    readonly option: Option;
    readonly displayField: string;
  }

  type Emits = (event: 'click', value: Option) => void

  const { option, displayField } = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const displayValue = computed(() => {
    if (isRecord(option)) {
      return option[displayField] ?? 'N/A';
    }

    return 'N/A';
  })

  function handleClick() {
    emit('click', option);
  }
</script>

<style module>
  .component {
    display: flex;
    align-items: center;
    height: var(--input-height);
    padding: 0 var(--input-spacing-horizontal);
  }
</style>
