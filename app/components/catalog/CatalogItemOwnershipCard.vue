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

    <p v-if="description" :class="$style.text">
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
      Inventory state unavailable.
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
        color-mix(in oklch, var(--color-accent-primary), transparent 90%),
        color-mix(in oklch, var(--color-accent-primary), transparent 95%) 45%,
        var(--color-surface-primary)
      );
  }

  .header {
    display: grid;
    gap: var(--spacing-16);
  }

  .badgeIcon {
    font-size: 1rem;
  }

  .text {
    margin: 0;
    color: var(--color-text-tertiary);
  }

  .inlineMessage {
    margin: 0;
    color: var(--color-text-tertiary);
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-12);
    align-items: center;
  }
</style>
