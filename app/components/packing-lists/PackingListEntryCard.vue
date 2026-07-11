<template>
  <li :class="$style.component">
    <div :class="$style.body">
      <p :class="$style.title">
        {{ entry.title }}
      </p>

      <p v-if="hasSubtitle" :class="$style.subtitle">
        {{ entry.subtitle }}
      </p>
    </div>

    <PerdIconButton
      icon="hugeicons:delete-02"
      :label="removeLabel"
      :loading="entry.isRemoving"
      :disabled="entry.isRemoveDisabled"
      variant="danger"
      @click="emitRemove"
    />
  </li>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { PackingListEntryView } from '~/types/packing'
  import PerdIconButton from '~/components/PerdIconButton.vue'

  interface Props {
    entry: PackingListEntryView;
  }

  type Emits = (event: 'remove', entryId: string) => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const hasSubtitle = computed(() => props.entry.subtitle !== '')
  const removeLabel = computed(() => `Remove ${props.entry.title}`)

  function emitRemove() {
    emit('remove', props.entry.id)
  }
</script>

<style module>
  .component {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-4);
    padding: var(--spacing-8) var(--spacing-12);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-10);
    background: var(--color-surface-primary);
    list-style: none;
  }

  .body {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .title {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .subtitle {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

</style>
