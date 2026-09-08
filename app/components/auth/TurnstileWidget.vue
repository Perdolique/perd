<template>
  <ModalDialog
    v-model="isOpened"
    :class="$style.dialog"
    :aria-labelledby="headingId"
    :aria-describedby="descriptionId"
  >
    <div :class="$style.component">
      <div :class="$style.header">
        <h2 :id="headingId" ref="heading" :class="$style.heading" tabindex="-1" autofocus>
          Security check
        </h2>

        <button
          type="button"
          :class="$style.closeButton"
          aria-label="Close security check"
          @click="close"
        >
          <Icon name="hugeicons:cancel-01" aria-hidden="true" />
        </button>
      </div>

      <p :id="descriptionId" :class="$style.description" role="status">
        Complete the security check to continue.
      </p>

      <div ref="container" :class="$style.widget" />

      <div v-if="hasError" :class="$style.error">
        <p role="alert">
          {{ errorMessage }}
        </p>

        <PerdButton @click="execute">
          Try again
        </PerdButton>
      </div>
    </div>
  </ModalDialog>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
  import { useScript } from '#imports'
    import PerdButton from '~/components/PerdButton.vue'
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'

  interface Props {
    action: string;
    sitekey: string;
  }

  interface TurnstileRenderOptions {
    action: string;
    appearance: 'interaction-only';
    execution: 'execute';
    retry: 'never';
    'refresh-expired': 'manual';
    'refresh-timeout': 'manual';
    'before-interactive-callback': () => void;
    'timeout-callback': () => void;
    callback: (token: string) => void;
    'error-callback': (code: string) => boolean;
    'expired-callback': () => void;
    'response-field': false;
    sitekey: string;
    size: 'flexible';
  }

  interface TurnstileApi {
    execute: (widgetId: string) => void;
    remove: (widgetId: string) => void;
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  }

  const { action, sitekey } = defineProps<Props>()

  const emit = defineEmits<{
    verified: [token: string];
    error: [message: string];
    cancel: [];
  }>()

  const isOpened = ref(false)
  const heading = useTemplateRef('heading')
  const headingId = useId()
  const descriptionId = useId()
  let isExecuting = false
  let hasPendingAttempt = false
  let widgetGeneration = 0
  const container = useTemplateRef('container')
  const errorMessage = ref<string | null>(null)
  const widgetId = ref<string | null>(null)
  const hasError = computed(() => errorMessage.value !== null)
  const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  let turnstile: TurnstileApi | null = null

  function close() {
    isOpened.value = false
  }

  function getTurnstileApi(): TurnstileApi | undefined {
    const api: unknown = Reflect.get(globalThis, 'turnstile')

    if (typeof api !== 'object' || api === null) {
      return
    }

    return api as TurnstileApi
  }

  const script = useScript<TurnstileApi>(scriptUrl, {
    trigger: 'manual',
    bundle: false,
    proxy: false,
    use: getTurnstileApi
  })

  function removeWidget() {
    widgetGeneration += 1

    const currentWidgetId = widgetId.value

    widgetId.value = null

    if (currentWidgetId !== null) {
      turnstile?.remove(currentWidgetId)
    }
  }

  function isActiveWidget(generation: number) {
    return isExecuting && generation === widgetGeneration
  }

  function setUnavailableError(generation = widgetGeneration) {
    if (!isActiveWidget(generation)) {
      return
    }

    isExecuting = false
    errorMessage.value = 'Security check is unavailable. Try again.'

    removeWidget()

    if (!isOpened.value) {
      hasPendingAttempt = false

      emit('error', errorMessage.value)
    }
  }

  function handleToken(nextToken: string, generation: number) {
    if (!isActiveWidget(generation)) {
      return
    }

    isExecuting = false
    hasPendingAttempt = false
    isOpened.value = false
    errorMessage.value = null

    removeWidget()
    emit('verified', nextToken)
  }

  function handleInteractive(generation: number) {
    if (isActiveWidget(generation)) {
      isOpened.value = true
    }
  }

  function handleChallengeError(code: string, generation: number) {
    if (isActiveWidget(generation)) {
      globalThis.console.warn('Turnstile challenge failed:', code)
      setUnavailableError(generation)
    }

    return true
  }

  function renderWidget() {
    const target = container.value

    if (widgetId.value !== null) {
      return
    }

    if (turnstile === null || target === null) {
      setUnavailableError()

      return
    }

    try {
      const generation = widgetGeneration

      widgetId.value = turnstile.render(target, {
        action,
        appearance: 'interaction-only',
        execution: 'execute',
        retry: 'never',
        'refresh-expired': 'manual',
        'refresh-timeout': 'manual',
        'before-interactive-callback': () => handleInteractive(generation),
        'timeout-callback': () => setUnavailableError(generation),
        callback: token => handleToken(token, generation),
        'error-callback': code => handleChallengeError(code, generation),
        'expired-callback': () => setUnavailableError(generation),
        'response-field': false,
        sitekey,
        size: 'flexible'
      })

      if (isExecuting) {
        turnstile.execute(widgetId.value)
      }
    } catch (error) {
      globalThis.console.warn('Turnstile widget could not render:', error)
      setUnavailableError()
    }
  }

  async function loadWidget() {
    const generation = widgetGeneration

    try {
      const apiPromise = script.status.value === 'error' ? script.reload() : script.load()
      const api = await apiPromise

      if (generation !== widgetGeneration) {
        return
      }

      if (script.status.value !== 'loaded') {
        setUnavailableError(generation)

        return
      }

      turnstile = api

      renderWidget()
    } catch (error) {
      if (generation !== widgetGeneration) {
        return
      }

      globalThis.console.warn('Turnstile SDK could not load:', error)
      setUnavailableError(generation)
    }
  }

  function execute() {
    if (isExecuting) {
      return
    }

    isExecuting = true
    hasPendingAttempt = true
    errorMessage.value = null

    try {
      if (turnstile !== null && widgetId.value !== null) {
        turnstile.execute(widgetId.value)
      } else {
        void loadWidget()
      }
    } catch (error) {
      globalThis.console.warn('Turnstile verification could not start:', error)
      setUnavailableError()
    }
  }

  watch(isOpened, async (opened) => {
    if (opened) {
      await nextTick()
      heading.value?.focus()

      return
    }

    if (hasPendingAttempt) {
      hasPendingAttempt = false
      isExecuting = false
      errorMessage.value = null

      removeWidget()
      emit('cancel')
    }
  })

  onMounted(() => {
    void loadWidget()
  })

  onBeforeUnmount(() => {
    isExecuting = false
    hasPendingAttempt = false

    removeWidget()
  })

  defineExpose({ execute })
</script>

<style module>
  .dialog {
    left: 50%;
    inline-size: min(100% - var(--spacing-16), 24rem);
    max-inline-size: calc(100% - var(--spacing-8));

    @media (width < 360px) {
      inline-size: 100%;
      max-inline-size: 100%;
    }
  }

  .component {
    display: grid;
    gap: var(--spacing-16);
    padding: var(--spacing-16);
    border-radius: var(--border-radius-24);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-large);

    @media (width < 360px) {
      padding-inline: 0;
    }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
  }

  .heading {
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-semibold);
  }

  .closeButton {
    display: inline-grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-12);
    background: var(--color-surface-secondary);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .description {
    color: var(--color-text-muted);
    font-size: var(--font-size-14);
  }

  .widget {
    min-block-size: 65px;
  }

  .error {
    display: grid;
    gap: var(--spacing-12);
    font-size: var(--font-size-14);
  }

  @media (width < 360px) {
    .header,
    .description,
    .error {
      margin-inline: var(--spacing-8);
    }
  }
</style>
