<template>
  <form
    :class="$style.form"
    @submit.prevent="handleSubmit"
  >
    <SearchInput
      v-model="searchModel"
      :loading="loading"
      @clear="onSearchClear"
    />

    <StatusSelect
      :model-value="statusModel"
      :loading="loading"
      @update:model-value="onStatusChange"
    />

    <PerdButton
      type="submit"
      :loading="loading"
      icon="tabler:filter"
    >
      Apply filters
    </PerdButton>

    <PerdButton
      type="button"
      secondary
      :disabled="loading"
      icon="tabler:rotate-clockwise"
      @click="onResetClick"
    >
      Reset
    </PerdButton>
  </form>

  <div :class="$style.mobileControls">
    <PerdButton
      small
      icon="tabler:filter"
      :loading="loading"
      @click="showDialog"
    >
      Filter equipment
    </PerdButton>

    <PerdButton
      small
      type="button"
      secondary
      icon="tabler:rotate-clockwise"
      :disabled="loading"
      @click="onResetClick"
    >
      Reset
    </PerdButton>
  </div>

  <EquipmentFilterDialog
    v-model="isDialogOpened"
    v-model:search="searchModel"
    v-model:status="statusModel"
    @submit="handleSubmit"
  />
</template>

<script lang="ts" setup>
  import type { EquipmentStatus } from '~~/server/models'
  import PerdButton from '@/components/PerdButton.vue'
  import SearchInput from './SearchInput.vue';
  import StatusSelect from './StatusSelect.vue';
  import EquipmentFilterDialog from './EquipmentFilterDialog.vue';

  interface Props {
    readonly loading: boolean;
  }

  interface Emits {
    (event: 'submit') : void
  }

  defineProps<Props>()

  const emit = defineEmits<Emits>()
  const isDialogOpened = ref(false);

  const searchModel = defineModel<string>('search', {
    required: true
  })

  const statusModel = defineModel<string>('status', {
    required: true,
    default: '' satisfies EquipmentStatus | ''
  })

  function showDialog() {
    isDialogOpened.value = true;
  }

  function handleSubmit() {
    emit('submit')
  }

  function onStatusChange(value: string) {
    statusModel.value = value

    emit('submit')
  }

  function onResetClick() {
    searchModel.value = ''
    statusModel.value = ''

    emit('submit')
  }

  function onSearchClear() {
    emit('submit')
  }
</script>

<style lang="scss" module>
  .form {
    display: none;

    @include tablet() {
      display: grid;
      grid-template-columns:
        minmax(max-content, 300px)
        max-content
        max-content
        max-content;
      column-gap: var(--spacing-12);
    }
  }

  .mobileControls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);

    @include tablet() {
      display: none;
    }
  }
</style>
