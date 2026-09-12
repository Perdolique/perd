<template>
  <AuthFormPanel
    title="Choose a new password"
    description="Use a new password for your Metsik account."
  >
    <p v-if="pageState.phase === 'checking'" :class="$style.notice" role="status">Checking your reset link…</p>

    <template v-else-if="pageState.phase === 'complete'">
      <p ref="successStatus" :class="$style.notice" role="status" tabindex="-1">
        Your password has been reset. Sign in with your new password.
      </p>
      <PerdButton :to="signInTarget" variant="ghost">Continue to sign in</PerdButton>
    </template>

    <template v-else-if="pageState.phase === 'invalid'">
      <p ref="invalidStatus" :class="$style.error" role="alert" tabindex="-1">
        This password reset link is invalid or expired.
      </p>
      <PerdButton :to="recoveryTarget" variant="ghost">Request a new reset email</PerdButton>
    </template>

    <template v-else>
      <form :class="$style.form" @submit.prevent="submit">
        <TextInput
          ref="passwordInput"
          v-model="password"
          name="password"
          label="New password"
          type="password"
          autocomplete="new-password"
          hint="Use 15–128 characters. Spaces and passphrases are welcome."
          :error="passwordError"
          required
          :disabled="isPending"
        />

        <TextInput
          ref="confirmationInput"
          v-model="confirmation"
          name="password-confirmation"
          label="Confirm password"
          type="password"
          autocomplete="new-password"
          :error="confirmationError"
          required
          :disabled="isPending"
        />

        <p v-if="errorMessage" :class="$style.error" role="alert">{{ errorMessage }}</p>

        <PerdButton
          ref="submitButton"
          type="submit"
          :loading="isPending"
          block
        >
          Reset password
        </PerdButton>
      </form>

      <PerdButton :to="recoveryTarget" :disabled="isPending" variant="ghost">Request a new reset email</PerdButton>
    </template>

    <TurnstileWidget
      v-if="pageState.phase === 'ready'"
      ref="turnstileWidget"
      :sitekey="turnstileSiteKey"
      :action="passwordRecoveryResetTurnstileAction"
      @verified="resetPassword"
      @error="verificationFailed"
      @cancel="verificationCancelled"
    />
  </AuthFormPanel>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useHead, useRequestFetch, useRoute, useRouter, useRuntimeConfig } from '#imports'
  import { isEmailAuthenticationPasswordValid } from '#shared/utils/email-authentication'
  import { passwordRecoveryResetTurnstileAction, turnstileResponseFieldName } from '#shared/utils/turnstile'
  import { getPasswordRecoveryResetError } from '~/utils/password-recovery'
  import { getRedirectNavigationTarget } from '~/utils/router'
  import AuthFormPanel from '~/components/auth/AuthFormPanel.vue'
  import TurnstileWidget from '~/components/auth/TurnstileWidget.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import TextInput from '~/components/TextInput.vue'

  definePageMeta({
    layout: 'auth',
    skipAuth: true
  })

  type ResetPageState =
    | { phase: 'checking'; }
    | { phase: 'ready'; token: string; }
    | { phase: 'invalid'; }
    | { phase: 'complete'; }

  useHead({
    meta: [{
      name: 'referrer',
      content: 'no-referrer'
    }]
  })

  const router = useRouter()
  const route = useRoute()
  const requestFetch = useRequestFetch()
  const runtimeConfig = useRuntimeConfig()
  const { turnstileSiteKey } = runtimeConfig.public
  const pageState = ref<ResetPageState>({ phase: 'checking' })
  const password = ref('')
  const confirmation = ref('')
  const passwordError = ref<string>()
  const confirmationError = ref<string>()
  const errorMessage = ref<string | null>(null)
  const isPending = ref(false)
  const passwordInput = useTemplateRef('passwordInput')
  const confirmationInput = useTemplateRef('confirmationInput')
  const submitButton = useTemplateRef('submitButton')
  const invalidStatus = useTemplateRef('invalidStatus')
  const successStatus = useTemplateRef('successStatus')
  const turnstileWidget = useTemplateRef('turnstileWidget')
  const redirectTo = computed(() => getRedirectNavigationTarget(route.query.redirectTo).path)

  const recoveryTarget = computed(() => {
    return {
      path: '/forgot-password',
      query: { redirectTo: redirectTo.value }
    }
  })

  const signInTarget = computed(() => {
    return {
      path: '/login',
      query: { redirectTo: redirectTo.value }
    }
  })

  onMounted(async () => {
    const fragment = new globalThis.URLSearchParams(globalThis.location.hash.slice(1))
    const candidate = fragment.get('token')
    const cleanUrl = `${globalThis.location.pathname}${globalThis.location.search}`
    const historyState: unknown = globalThis.history.state

    if (historyState !== null && typeof historyState === 'object') {
      Reflect.set(historyState, 'current', cleanUrl)
    }

    globalThis.history.replaceState(historyState, '', cleanUrl)

    if (candidate !== null && /^[\w-]{43}$/u.test(candidate)) {
      pageState.value = {
        phase: 'ready',
        token: candidate
      }
    } else {
      pageState.value = { phase: 'invalid' }
    }

    await router.replace(cleanUrl)

    if (pageState.value.phase === 'invalid') {
      await nextTick()
      invalidStatus.value?.focus()
    }
  })

  function submit() {
    if (isPending.value || pageState.value.phase !== 'ready') {
      return
    }

    passwordError.value = undefined
    confirmationError.value = undefined
    errorMessage.value = null

    if (!isEmailAuthenticationPasswordValid(password.value)) {
      passwordError.value = 'Use a password between 15 and 128 characters.'

      passwordInput.value?.focus()

      return
    }

    if (password.value !== confirmation.value) {
      confirmationError.value = 'Passwords do not match.'

      confirmationInput.value?.focus()

      return
    }

    isPending.value = true

    turnstileWidget.value?.execute()
  }

  async function finishAttempt() {
    isPending.value = false

    await nextTick()
    submitButton.value?.focus()
  }

  async function verificationCancelled() {
    await finishAttempt()
  }

  async function verificationFailed(message: string) {
    errorMessage.value = message

    await finishAttempt()
  }

  async function resetPassword(turnstileToken: string) {
    const currentState = pageState.value

    if (currentState.phase !== 'ready') {
      isPending.value = false

      return
    }

    const resetToken = currentState.token

    try {
      await requestFetch('/api/auth/email/password-recovery/reset', {
        method: 'POST',

        body: {
          token: resetToken,
          password: password.value,
          [turnstileResponseFieldName]: turnstileToken
        }
      })

      password.value = ''
      confirmation.value = ''
      pageState.value = { phase: 'complete' }

      await nextTick()
      successStatus.value?.focus()
    } catch (error) {
      const recoveryError = getPasswordRecoveryResetError(error)

      errorMessage.value = recoveryError.message

      if (recoveryError.kind === 'invalid-link') {
        password.value = ''
        confirmation.value = ''
        pageState.value = { phase: 'invalid' }

        await nextTick()
        invalidStatus.value?.focus()
      } else if (recoveryError.kind === 'compromised-password') {
        password.value = ''
        confirmation.value = ''
        isPending.value = false

        await nextTick()
        passwordInput.value?.focus()
      } else {
        isPending.value = false

        await nextTick()
        submitButton.value?.focus()
      }
    } finally {
      isPending.value = false
    }
  }
</script>

<style module>
  @import '../../assets/styles/auth-form.css';
</style>
