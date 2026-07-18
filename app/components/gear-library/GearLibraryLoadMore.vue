<template>
  <div v-if="showComponent" :class="$style.component">
    <div v-if="hasError" :class="$style.error" role="alert">
      <p>
        Could not load more results.
      </p>

      <PerdButton size="small" variant="secondary" @click="emitRetry">
        Retry
      </PerdButton>
    </div>

    <PerdButton
      v-else
      :loading="isLoading"
      variant="secondary"
      @click="emitLoadMore"
    >
      Load more
    </PerdButton>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    hasError: boolean;
    isLoading: boolean;
    isVisible: boolean;
  }

  interface Emits {
    loadMore: [];
    retry: [];
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const showComponent = computed(() => props.isVisible || props.hasError)

  function emitLoadMore() {
    emit('loadMore')
  }

  function emitRetry() {
    emit('retry')
  }
</script>

<style module>
  .component {
    display: flex;
    justify-content: center;
    padding-block-start: var(--spacing-16);
  }

  .error {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-12);
    padding: var(--spacing-12) var(--spacing-16);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--border-radius-16);
    background: var(--color-danger-subtle);
    color: var(--color-danger-primary);
  }
</style>
