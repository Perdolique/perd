<template>
  <div :class="$style.component">
    <span v-if="isSaved" :class="$style.saved">
      <Icon name="hugeicons:tick-02" aria-hidden="true" />
      In My gear
    </span>

    <template v-else>
      <PerdButton
        :aria-describedby="errorDescriptionId"
        :loading="isSaving"
        icon="hugeicons:backpack-03"
        size="small"
        variant="soft"
        @click="emit('add')"
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
  import { computed, useId } from 'vue'

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
  const errorId = useId()
  const errorDescriptionId = computed(() => props.hasError ? errorId : undefined)
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
