<template>
  <PerdCard :class="$style.component">
    <div :class="$style.content">
      <IconTitle icon="hugeicons:alert-02" :level="2">
        {{ title }}
      </IconTitle>

      <p v-if="copy" :class="$style.copy">
        {{ copy }}
      </p>

      <PerdButton
        variant="danger"
        icon="hugeicons:delete-02"
        @click="emitAction"
      >
        {{ actionText }}
      </PerdButton>
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import IconTitle from '~/components/IconTitle.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'

  interface Props {
    actionText: string;
    copy?: string;
    title: string;
  }

  type Emits = (event: 'action') => void

  defineProps<Props>()

  const emit = defineEmits<Emits>()

  function emitAction() {
    emit('action')
  }
</script>

<style module>
  .component {
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-danger-primary), transparent 94%),
        var(--color-surface-primary)
      );
  }

  .content {
    display: grid;
    gap: var(--spacing-16);
    justify-items: start;
  }

  .copy {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }
</style>
