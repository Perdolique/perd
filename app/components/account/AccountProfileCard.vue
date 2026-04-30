<template>
  <PerdCard :class="$style.component">
    <div :class="$style.header">
      <UserAvatar :initial="userInitial" size="large" />

      <div :class="$style.intro">
        <p :class="$style.eyebrow">
          Field profile
        </p>

        <PerdHeading :level="2">
          Profile Information
        </PerdHeading>
      </div>
    </div>

    <div :class="$style.infoBlock">
      <div :class="$style.infoItem">
        <span :class="$style.label">
          User ID
        </span>

        <span :class="$style.value">
          {{ userIdText }}
        </span>
      </div>

      <div :class="$style.infoItem">
        <span :class="$style.label">
          Role
        </span>

        <span :class="$style.value">
          {{ role }}
        </span>
      </div>
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import UserAvatar from '~/components/UserAvatar.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    role: string;
    userIdText: string;
    userInitial: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: grid;
    row-gap: var(--spacing-24);
    container-type: inline-size;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-16);
    align-items: center;
  }

  .intro {
    display: grid;
    gap: var(--spacing-8);
  }

  .eyebrow {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .infoBlock {
    display: grid;
    row-gap: var(--spacing-16);

    @container (inline-size >= 40rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: var(--spacing-16);
    }
  }

  .infoItem {
    display: grid;
    row-gap: var(--spacing-8);
    justify-content: start;
    padding: var(--spacing-16);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border-subtle);
  }

  .label {
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .value {
    font-size: var(--font-size-14);
    color: var(--color-text-primary);
  }
</style>
