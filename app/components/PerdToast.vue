<template>
  <section :class="$style.component">
    <div :class="$style.header">
      <PerdHeading :level="3">
        {{ title }}
      </PerdHeading>

      <IconButton
        icon="tabler:x"
        secondary
        small
        @click="removeToast(toastId)"
      />
    </div>

    <div>
      {{ message }}
    </div>

    <div :class="$style.progress" />
  </section>
</template>

<script lang="ts" setup>
  import IconButton from '~/components/IconButton.vue';
  import PerdHeading from '~/components/PerdHeading.vue';

  interface Props {
    readonly message: Toast['message'];
    readonly toastId: Toast['id'];
    readonly title: Toast['title'];
    readonly duration: Toast['duration'];
  }

  const { duration, toastId } = defineProps<Props>()
  const { removeToast } = useToaster()
  const timer = ref<number | undefined>()
  const progressDuration = computed(() => `${duration}ms`)

  function runTimer() {
    if (typeof duration === 'number') {
      timer.value = window.setTimeout(() => {
        removeToast(toastId)
      }, duration)
    }
  }

  function stopTimer() {
    clearTimeout(timer.value)
  }

  onMounted(() => {
    runTimer()
  })

  onBeforeUnmount(() => {
    stopTimer()
  })
</script>

<style module>
  .component {
    position: relative;
    max-width: 400px;
    display: grid;
    row-gap: var(--spacing-12);
    align-items: center;
    overflow: hidden;
    border: 1px solid var(--secondary-200);
    background-color: var(--background-50);
    border-radius: var(--border-radius-16);
    padding: var(--spacing-16);

    /* For TransitionGroup animation */
    width: max-content;
    margin-left: auto;
    margin-bottom: var(--spacing-8);
  }

  .header {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: var(--spacing-16);
  }

  .progress {
    --size: 6px;

    position: absolute;
    bottom: 0;
    left: 0;
    height: var(--size);
    border-radius: var(--size);
    background-color: var(--accent-300);
    width: 0;
    transition: width v-bind(progressDuration) linear;
    box-shadow: var(--shadow-2);

    @starting-style {
      width: 100%;
    }
  }
</style>
