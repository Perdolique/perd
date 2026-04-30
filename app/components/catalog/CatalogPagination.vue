<template>
  <div v-if="isVisible" :class="$style.component">
    <PerdButton
      size="small"
      variant="secondary"
      :disabled="isPreviousDisabled"
      @click="emitPrevious"
    >
      Previous
    </PerdButton>

    <p :class="$style.text">
      Page {{ page }} of {{ totalPages }}
    </p>

    <PerdButton
      size="small"
      variant="secondary"
      :disabled="isNextDisabled"
      @click="emitNext"
    >
      Next
    </PerdButton>
  </div>
</template>

<script lang="ts" setup>
  import PerdButton from '~/components/PerdButton.vue'

  interface Props {
    isNextDisabled: boolean;
    isPreviousDisabled: boolean;
    isVisible: boolean;
    page: number;
    totalPages: number;
  }

  type Emits = (event: 'next' | 'previous') => void

  defineProps<Props>()
  const emit = defineEmits<Emits>()

  function emitNext() {
    emit('next')
  }

  function emitPrevious() {
    emit('previous')
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-12);
    align-items: center;
    padding-block-start: var(--spacing-16);

    @container (inline-size >= 40rem) {
      grid-template-columns: auto auto auto;
      justify-content: space-between;
    }
  }

  .text {
    margin: 0;
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
