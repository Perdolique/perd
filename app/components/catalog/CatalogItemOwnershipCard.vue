<template>
  <PerdCard :class="$style.component">
    <div :class="$style.header">
      <IconTitle icon="tabler:backpack" :level="2">
        Ownership
      </IconTitle>

      <p :class="[$style.badge, stateClass]" role="status">
        <Icon
          :name="stateIcon"
          :class="$style.badgeIcon"
          aria-hidden="true"
        />

        <span>{{ stateText }}</span>
      </p>
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
  import IconTitle from '~/components/IconTitle.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdLink from '~/components/PerdLink.vue'

  type OwnershipActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

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

  defineProps<Props>()
  const emit = defineEmits<Emits>()

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

  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-8);
    width: fit-content;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);

    &:global(.owned) {
      background: var(--color-success-subtle);
      color: var(--color-success);
    }

    &:global(.missing) {
      background: var(--color-surface-subtle);
      color: var(--color-text-secondary);
      border-color: var(--color-border-subtle);
    }

    &:global(.pending) {
      background: var(--color-warning-subtle);
      color: var(--color-warning);
    }

    &:global(.error) {
      background: var(--color-danger-subtle);
      color: var(--color-danger);
    }
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
