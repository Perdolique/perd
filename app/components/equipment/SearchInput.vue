<template>
  <PerdInput
    v-model.trim="model"
    label="Search"
    placeholder="Name, description, etc."
    autocomplete="off"
    :disabled="loading"
    @clear="onClear"
  />
</template>

<script lang="ts" setup>
  import PerdInput from '@/components/PerdInput.vue'

  interface Props {
    readonly loading?: boolean;
  }

  interface Emits {
    (event: 'clear') : void
  }

  defineProps<Props>()

  const emit = defineEmits<Emits>()

  const model = defineModel<string>({
    required: true
  })

  function onClear() {
    emit('clear')
  }
</script>
