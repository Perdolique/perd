<template>
  <li :class="$style.component">
    <div :class="$style.content">
      <label :class="$style.packControl">
        <input
          ref="packCheckbox"
          :class="$style.checkbox"
          type="checkbox"
          :checked="entry.isPacked"
          :disabled="entry.isPackDisabled"
          :aria-describedby="packErrorDescriptionId"
          @change="handlePackChange"
        >

        <span :class="$style.body">
          <span :class="$style.title">{{ entry.title }}</span>
          <span v-if="hasSubtitle" :class="$style.subtitle">{{ entry.subtitle }}</span>
        </span>
      </label>

      <span v-if="entry.isPacking" :class="$style.status" role="status">Saving {{ entry.title }}…</span>

      <p v-if="entry.hasPackError" :id="packErrorId" :class="$style.error" role="alert">
        Could not update {{ entry.title }}. Try again.
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
  import { computed, nextTick, useId, useTemplateRef, watch } from 'vue'
  import type { PackingListEntryView } from '~/types/packing'
  import PerdIconButton from '~/components/PerdIconButton.vue'

  interface Props {
    entry: PackingListEntryView;
  }

  interface Emits {
    packChange: [entryId: string, isPacked: boolean];
    remove: [entryId: string];
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const packCheckbox = useTemplateRef('packCheckbox')
  const packErrorId = useId()
  let shouldRestorePackFocus = false
  const hasSubtitle = computed(() => props.entry.subtitle !== '')
  const packErrorDescriptionId = computed(() => props.entry.hasPackError ? packErrorId : undefined)
  const removeLabel = computed(() => `Remove ${props.entry.title}`)

  function handlePackChange(event: Event) {
    const checkbox = event.currentTarget as HTMLInputElement

    if (props.entry.isPackDisabled) {
      checkbox.checked = props.entry.isPacked

      return
    }

    shouldRestorePackFocus = globalThis.document.activeElement === checkbox

    emit('packChange', props.entry.id, checkbox.checked)
  }

  function emitRemove() {
    emit('remove', props.entry.id)
  }

  watch(() => props.entry.isPacking, async (isPacking, wasPacking) => {
    if (wasPacking === false || isPacking || shouldRestorePackFocus === false) {
      return
    }

    shouldRestorePackFocus = false

    await nextTick()

    if (props.entry.isPackFocusTarget && globalThis.document.activeElement === globalThis.document.body) {
      packCheckbox.value?.focus()
    }
  })
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

  .content {
    display: grid;
    gap: var(--spacing-4);
  }

  .packControl {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
    min-block-size: var(--layout-touch-target);
    cursor: pointer;

    &:has(.checkbox:disabled) {
      cursor: not-allowed;
    }
  }

  .checkbox {
    inline-size: 1.125rem;
    block-size: 1.125rem;
    accent-color: var(--color-accent-primary);

    @media (forced-colors: active) {
      &:focus {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }
    }
  }

  .body {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .title {
    color: var(--color-text-primary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .subtitle {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-12);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .status,
  .error {
    font-size: var(--font-size-12);
    overflow-wrap: anywhere;
  }

  .status {
    color: var(--color-text-tertiary);
  }

  .error {
    color: var(--color-danger-primary);
  }
</style>
