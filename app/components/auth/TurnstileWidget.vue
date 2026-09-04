<template>
  <div :class="$style.component">
    <div ref="container" :class="$style.widget" />

    <p v-if="hasError" :class="$style.error" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
  import { guestSessionTurnstileAction } from '#shared/utils/turnstile'

  interface Props {
    sitekey: string;
  }

  interface TurnstileRenderOptions {
    action: string;
    appearance: 'interaction-only';
    callback: (token: string) => void;
    'error-callback': () => boolean;
    'expired-callback': () => void;
    'response-field': false;
    sitekey: string;
    size: 'flexible';
  }

  interface TurnstileApi {
    remove: (widgetId: string) => void;
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
    reset: (widgetId: string) => void;
  }

  const { sitekey } = defineProps<Props>()
  const token = defineModel<string>({ required: true })
  const container = useTemplateRef('container')
  const errorMessage = ref<string | null>(null)
  const widgetId = ref<string | null>(null)
  const hasError = computed(() => errorMessage.value !== null)
  const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  const scriptSelector = `script[src="${scriptUrl}"]`
  let scriptElement: HTMLScriptElement | null = null

  function getTurnstileApi(): TurnstileApi | undefined {
    const turnstile: unknown = Reflect.get(globalThis, 'turnstile')

    return typeof turnstile === 'object' && turnstile !== null
      ? turnstile as TurnstileApi
      : undefined
  }

  function setUnavailableError() {
    token.value = ''
    errorMessage.value = 'Security check is unavailable. Refresh the page and try again.'
  }

  function handleToken(nextToken: string) {
    errorMessage.value = null
    token.value = nextToken
  }

  function handleExpiredToken() {
    token.value = ''
  }

  function handleChallengeError() {
    setUnavailableError()

    return true
  }

  function renderWidget() {
    const turnstile = getTurnstileApi()
    const target = container.value

    if (turnstile === undefined || target === null) {
      setUnavailableError()

      return
    }

    try {
      widgetId.value = turnstile.render(target, {
        action: guestSessionTurnstileAction,
        appearance: 'interaction-only',
        callback: handleToken,
        'error-callback': handleChallengeError,
        'expired-callback': handleExpiredToken,
        'response-field': false,
        sitekey,
        size: 'flexible'
      })
    } catch {
      setUnavailableError()
    }
  }

  function handleScriptLoad() {
    if (scriptElement !== null) {
      scriptElement.dataset.turnstileLoaded = 'true'
    }

    renderWidget()
  }

  function handleScriptError() {
    scriptElement?.remove()
    setUnavailableError()
  }

  function loadScript() {
    if (getTurnstileApi() !== undefined) {
      renderWidget()

      return
    }

    const existingScript = globalThis.document.querySelector<HTMLScriptElement>(scriptSelector)

    if (existingScript?.dataset.turnstileLoaded === 'true') {
      setUnavailableError()

      return
    }

    const script = existingScript ?? globalThis.document.createElement('script')

    scriptElement = script
    script.addEventListener('load', handleScriptLoad)
    script.addEventListener('error', handleScriptError)

    if (existingScript === null) {
      script.src = scriptUrl
      script.async = true
      // oxlint-disable-next-line unicorn/prefer-dom-node-append -- Worker ambient types overload append with response body types.
      globalThis.document.head.appendChild(script)
    }
  }

  function reset() {
    token.value = ''
    errorMessage.value = null

    const turnstile = getTurnstileApi()

    if (turnstile !== undefined && widgetId.value !== null) {
      turnstile.reset(widgetId.value)
    }
  }

  onMounted(loadScript)

  onBeforeUnmount(() => {
    scriptElement?.removeEventListener('load', handleScriptLoad)
    scriptElement?.removeEventListener('error', handleScriptError)

    const turnstile = getTurnstileApi()

    if (turnstile !== undefined && widgetId.value !== null) {
      turnstile.remove(widgetId.value)
    }

    token.value = ''
  })

  defineExpose({ reset })
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-8);
  }

  .error {
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-6);
    background: var(--color-black);
    color: var(--color-white);
    font-size: var(--font-size-14);
    text-align: center;
  }
</style>
