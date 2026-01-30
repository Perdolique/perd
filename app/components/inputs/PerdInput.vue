<template>
  <TextInput v-bind="props" />
</template>

<script lang="ts" setup>
  import TextInput, { type TextInputProps } from '@perd-ui/text-input'
  import '@perd-ui/text-input/style.css'

  const props = defineProps<TextInputProps>()
</script>
