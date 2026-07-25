<template>
  <div :class="$style.component">
    <span
      v-if="isSaved"
      ref="savedStatus"
      :class="$style.saved"
      tabindex="-1"
    >
      <Icon name="hugeicons:tick-02" aria-hidden="true" />
      In My gear
    </span>

    <template v-else>
      <PerdButton
        ref="addButton"
        :aria-describedby="errorDescriptionId"
        :loading="isSaving"
        icon="hugeicons:backpack-03"
        size="small"
        variant="soft"
        @click="handleAdd"
      >
        Add to My gear
        <span :class="$style.visuallyHidden"> {{ itemName }}</span>
      </PerdButton>

      <span v-if="hasError" :id="errorId" :class="$style.error">
        Could not add
      </span>
    </template>
  </div>
</template>

<script lang="ts" setup>
  import {
    computed,
    nextTick,
    ref,
    useId,
    useTemplateRef,
    watch
  } from 'vue'

  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    hasError: boolean;
    isSaved: boolean;
    isSaving: boolean;
    itemName: string;
  }

  interface Emits {
    add: [];
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const pendingSavedFocus = ref(false)
  const errorId = useId()
  const addButton = useTemplateRef('addButton')
  const savedStatus = useTemplateRef('savedStatus')
  const errorDescriptionId = computed(() => props.hasError ? errorId : undefined)

  function handleAdd(event: MouseEvent) {
    pendingSavedFocus.value = event.detail === 0

    emit('add')
  }

  watch([
    () => props.isSaved,
    () => props.hasError
  ], async ([isSaved, hasError]) => {
    if (hasError) {
      const shouldRestoreAddFocus = pendingSavedFocus.value

      pendingSavedFocus.value = false

      if (shouldRestoreAddFocus) {
        await nextTick()

        addButton.value?.focus()
      }

      return
    }

    if (isSaved === false || pendingSavedFocus.value === false) {
      return
    }

    pendingSavedFocus.value = false

    await nextTick()

    savedStatus.value?.focus()
  })
</script>

<style module>
  .component {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-8);
  }

  .saved {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-8);
    min-block-size: var(--layout-button-height-small);
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;

    &:focus-visible {
      border-radius: var(--border-radius-10);
      box-shadow: var(--shadow-focus);
    }
  }

  .error {
    color: var(--color-danger-primary);
    font-size: var(--font-size-12);
  }

  .visuallyHidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    border: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
