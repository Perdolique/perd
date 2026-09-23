import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRequestFetch } from '#imports'
import type { SessionUser } from '#server/utils/user'
import { passkeyMessages } from '#shared/utils/passkey'
import { getPasskeyErrorMessage, getPasskeyRequestStatus, isPasskeyCancellation } from '~/utils/passkey'

interface PasskeySignInOptions {
  canStart: () => boolean;
  onSuccess: (user: SessionUser) => Promise<void>;
  onError: (message: string) => Promise<void>;
}

/** Coordinates conditional and explicit WebAuthn with the login page's other sign-in methods. */
function usePasskeySignIn(options: PasskeySignInOptions) {
  const requestFetch = useRequestFetch()
  const supported = ref(false)
  const supportsAutofill = ref(false)
  const phase = ref<'idle' | 'options' | 'authenticator' | 'verify'>('idle')
  const conditional = ref(false)
  let attempt = 0
  let controller: AbortController | null = null
  let disposed = false
  let optionsSettled: Promise<unknown> = Promise.resolve()
  const isVerifying = computed(() => phase.value === 'verify')
  const isActive = computed(() => !conditional.value && phase.value !== 'idle')

  async function cancel() {
    attempt += 1

    controller?.abort()

    controller = null

    phase.value = 'idle'

    return optionsSettled
  }

  function ownsAttempt(currentAttempt: number): boolean {
    return currentAttempt === attempt && !disposed
  }

  async function reconcileSession(currentAttempt: number): Promise<boolean> {
    try {
      const user = await requestFetch('/api/user', { retry: 0 })

      if (ownsAttempt(currentAttempt) && user.userId !== null) {
        await options.onSuccess(user)

        return true
      }
    } catch {
      // The caller shows a safe error if the session cannot be recovered.
    }

    return false
  }

  async function handleFailure(error: unknown, currentAttempt: number, useAutofill: boolean) {
    if (!ownsAttempt(currentAttempt)) {
      return
    }

    const status = getPasskeyRequestStatus(error)
    const wasVerifying = isVerifying.value
    const verificationUncertain = wasVerifying && (status === undefined || status >= 500)
    let sessionReconciled = false

    if (verificationUncertain) {
      sessionReconciled = await reconcileSession(currentAttempt)
    }

    if (sessionReconciled) {
      return
    }

    if (!ownsAttempt(currentAttempt)) {
      return
    }

    phase.value = 'idle'

    if (!useAutofill || wasVerifying) {
      const message = status === 409 ? passkeyMessages.alreadySignedIn : getPasskeyErrorMessage(error)

      await options.onError(message)
    } else if (!isPasskeyCancellation(error)) {
      // Conditional UI is optional; the explicit action remains available after a failure.
      supportsAutofill.value = false
    }
  }

  async function start(useAutofill = false) {
    if (!supported.value || !options.canStart() || isVerifying.value) {
      return
    }

    void cancel()

    const currentAttempt = attempt
    const currentController = new globalThis.AbortController()

    controller = currentController
    conditional.value = useAutofill
    phase.value = 'options'

    try {
      const pendingOptions = requestFetch('/api/auth/passkeys/options', {
        method: 'POST',
        body: {},
        signal: currentController.signal,
        retry: 0
      })

      optionsSettled = Promise.allSettled([pendingOptions])

      const response = await pendingOptions

      if (!ownsAttempt(currentAttempt) || !options.canStart()) {
        return
      }

      phase.value = 'authenticator'

      const publicKey = globalThis.PublicKeyCredential.parseRequestOptionsFromJSON(response.options)
      const mediation = useAutofill ? 'conditional' : 'optional'

      const credential = await globalThis.navigator.credentials.get({
        publicKey,
        mediation,
        signal: currentController.signal
      })

      if (!(credential instanceof globalThis.PublicKeyCredential)) {
        throw new Error('Passkey authentication returned no credential')
      }

      const credentialJSON = credential.toJSON()

      if (!('signature' in credentialJSON.response)) {
        throw new Error('Passkey authentication returned an invalid credential')
      }

      if (!ownsAttempt(currentAttempt) || !options.canStart()) {
        return
      }

      phase.value = 'verify'

      const user = await requestFetch('/api/auth/passkeys/verify', {
        method: 'POST',

        body: {
          ceremonyId: response.ceremonyId,
          credential: credentialJSON
        },

        retry: 0
      })

      if (ownsAttempt(currentAttempt)) {
        await options.onSuccess(user)
      }
    } catch (error) {
      await handleFailure(error, currentAttempt, useAutofill)
    } finally {
      if (ownsAttempt(currentAttempt)) {
        phase.value = 'idle'
        controller = null
      }
    }
  }

  function rearmAutofill() {
    if (disposed || !supportsAutofill.value || phase.value !== 'idle' || !options.canStart()) {
      return
    }

    void start(true)
  }

  onMounted(async () => {
    supported.value = typeof globalThis.PublicKeyCredential === 'function'

    if (!supported.value) {
      return
    }

    try {
      const available = await globalThis.PublicKeyCredential.isConditionalMediationAvailable()

      if (disposed) {
        return
      }

      supportsAutofill.value = available

      if (available) {
        rearmAutofill()
      }
    } catch {
      supportsAutofill.value = false
    }
  })

  onBeforeUnmount(() => {
    disposed = true

    void cancel()
  })

  return {
    cancel,
    isActive,
    isVerifying,
    rearmAutofill,
    start,
    supported,
    supportsAutofill
  }
}

export { usePasskeySignIn }
