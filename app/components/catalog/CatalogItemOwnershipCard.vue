<template>
  <PerdCard :class="$style.component">
    <div :class="$style.header">
      <IconTitle icon="tabler:backpack" :level="2">
        Ownership
      </IconTitle>

      <PerdPill :tone="stateTone" role="status">
        <Icon
          :name="stateIcon"
          :class="$style.badgeIcon"
          aria-hidden="true"
        />

        <span>{{ stateText }}</span>
      </PerdPill>
    </div>

    <p :class="$style.text">
      {{ description }}
    </p>

    <div :class="$style.actions">
      <PerdButton
        :variant="actionVariant"
        :loading="isActionLoading"
        :disabled="isActionDisabled"
        :icon="actionIcon"
        @click="emitAction"
      >
        {{ actionText }}
      </PerdButton>

      <PerdLink to="/inventory">
        View inventory
      </PerdLink>
    </div>

    <p v-if="errorMessage" :class="$style.errorMessage" role="status">
      {{ errorMessage }}
    </p>

    <p v-else-if="hasInventoryError" :class="$style.inlineMessage" role="status">
      We could not confirm your inventory state right now. Reload this page to try again.
    </p>
  </PerdCard>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import IconTitle from '~/components/IconTitle.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PerdPill, { type PerdPillTone } from '~/components/PerdPill.vue'

  type OwnershipActionVariant = 'primary' | 'secondary' | 'danger'

  interface Props {
    actionIcon: string;
    actionText: string;
    actionVariant: OwnershipActionVariant;
    description: string;
    errorMessage: string | null;
    hasInventoryError: boolean;
    isActionDisabled: boolean;
    isActionLoading: boolean;
    stateClass: string;
    stateIcon: string;
    stateText: string;
  }

  type Emits = (event: 'ownership-action') => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const stateTone = computed<PerdPillTone>(() => {
    if (props.stateClass === 'owned') {
      return 'success'
    }

    if (props.stateClass === 'pending') {
      return 'warning'
    }

    if (props.stateClass === 'error') {
      return 'danger'
    }

    return 'neutral'
  })

  function emitAction() {
    emit('ownership-action')
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
    background:
      linear-gradient(
        160deg,
        color-mix(in oklch, var(--color-accent-base), transparent 90%),
        color-mix(in oklch, var(--color-accent-base), transparent 95%) 45%,
        var(--color-surface-base)
      );
  }

  .header {
    display: grid;
    gap: var(--spacing-16);
  }

  .badgeIcon {
    font-size: 1rem;
  }

  .text,
  .inlineMessage,
  .errorMessage {
    margin: 0;
  }

  .text,
  .inlineMessage {
    color: var(--color-text-tertiary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-12);
    align-items: center;
  }

  .errorMessage {
    color: var(--color-danger);
  }
</style>
