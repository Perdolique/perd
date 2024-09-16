<template>
  <TransitionGroup
    name="toaster"
    tag="div"
    :class="$style.component"
  >
    <PerdToast
      v-for="{ id, message, duration, title } in toasts"
      :key="id"
      :message="message"
      :title="title"
      :toast-id="id"
      :duration="duration"
    />
  </TransitionGroup>
</template>

<script lang="ts" setup>
  import PerdToast from './PerdToast.vue';

  const { toasts } = useToaster()
</script>

<style>
  .toaster-move {
    transition: transform var(--transition-time-medium);
  }

  .toaster-enter-active,
  .toaster-leave-active {
    transition:
      transform var(--transition-time-medium),
      opacity var(--transition-time-medium);
  }

  .toaster-enter-from,
  .toaster-leave-to {
    opacity: 0;
    transform: translateX(100%);
  }

  .toaster-leave-active {
    position: absolute;
    right: 0;
  }
</style>

<style module>
  .component {
    position: fixed;
    top: 0;
    right: 0;
    padding: var(--spacing-24);
  }
</style>
