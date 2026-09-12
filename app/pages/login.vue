<template>
  <AuthFormPanel title="Sign in">
    <TurnstileWidget
      :key="turnstileAction"
      ref="turnstileWidget"
      :sitekey="turnstileSiteKey"
      :action="turnstileAction"
      @verified="finishAuthentication"
      @error="handleVerificationError"
      @cancel="cancelAuthentication"
    />

    <p v-if="hasAuthenticationError" :class="$style.error" role="alert">
      {{ authenticationError }}
    </p>

    <form :class="$style.form" @submit.prevent="startEmailSignIn">
      <TextInput
        v-model="email"
        name="email"
        label="Email"
        type="email"
        autocomplete="username"
        :maxlength="254"
        required
        :disabled="isAuthenticationBusy"
      />

      <TextInput
        ref="passwordInput"
        v-model="password"
        name="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        :error="passwordError"
        required
        :disabled="isAuthenticationBusy"
      />

      <PerdButton
        ref="signInButton"
        type="submit"
        :loading="isEmailSignInActive"
        :disabled="isAuthenticationBusy"
        block
      >
        Sign in
      </PerdButton>
    </form>

    <PerdButton
      :to="passwordRecoveryTarget"
      :disabled="isAuthenticationBusy"
      variant="ghost"
      block
    >
      Forgot password?
    </PerdButton>

    <PerdButton
      v-if="emailRegistrationEnabled"
      :to="registrationTarget"
      :disabled="isAuthenticationBusy"
      variant="ghost"
      block
    >
      Create account
    </PerdButton>

    <div :class="$style.divider" aria-hidden="true">
      <span :class="$style.dividerLine" />
      <span>Or continue with</span>
      <span :class="$style.dividerLine" />
    </div>

    <div :class="$style.secondaryActions">
      <PerdButton
        ref="guestButton"
        variant="secondary"
        icon="hugeicons:game"
        :loading="isGuestActive"
        :disabled="isAuthenticationBusy"
        block
        @click="continueAsGuest"
      >
        Continue as guest
      </PerdButton>

      <PerdButton
        variant="secondary"
        icon="hugeicons:twitch"
        :loading="isTwitchActive"
        :disabled="isAuthenticationBusy"
        block
        @click="redirectToTwitch"
      >
        Continue with Twitch
      </PerdButton>
    </div>
  </AuthFormPanel>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef } from 'vue'

  import {
    definePageMeta,
    navigateTo,
    useRequestFetch,
    useRoute,
    useRuntimeConfig,
    useUserStore,
    withMinimumDelay
  } from '#imports'

  import { isEmailAuthenticationPasswordValid } from '#shared/utils/email-authentication'
  import { isEmailRegistrationEnabled } from '#shared/utils/email-registration'

  import {
    emailSignInTurnstileAction,
    guestSessionTurnstileAction,
    turnstileResponseFieldName
  } from '#shared/utils/turnstile'

  import { getRedirectNavigationTarget } from '~/utils/router'
  import AuthFormPanel from '~/components/auth/AuthFormPanel.vue'
  import TurnstileWidget from '~/components/auth/TurnstileWidget.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import TextInput from '~/components/TextInput.vue'

  type TurnstileAuthenticationMethod = 'email' | 'guest'

  type ActiveAuthentication =
    | { method: TurnstileAuthenticationMethod; phase: 'request' | 'turnstile'; }
    | { method: 'twitch'; phase: 'redirect'; }

  definePageMeta({
    layout: 'auth'
  })

  const route = useRoute()
  const runtimeConfig = useRuntimeConfig()
  const { public: publicRuntimeConfig } = runtimeConfig
  const emailRegistrationEnabled = isEmailRegistrationEnabled(publicRuntimeConfig.emailRegistrationEnabled)
  const { turnstileSiteKey } = publicRuntimeConfig
  const email = ref('')
  const password = ref('')
  const passwordError = ref<string>()
  const authenticationError = ref<string | null>(null)
  const activeAuthentication = ref<ActiveAuthentication | null>(null)
  const turnstileAction = ref(emailSignInTurnstileAction)
  const requestFetch = useRequestFetch()
  const { user } = useUserStore()
  const turnstileWidget = useTemplateRef('turnstileWidget')
  const passwordInput = useTemplateRef('passwordInput')
  const signInButton = useTemplateRef('signInButton')
  const guestButton = useTemplateRef('guestButton')
  const hasAuthenticationError = computed(() => authenticationError.value !== null)
  const isAuthenticationBusy = computed(() => activeAuthentication.value !== null)
  const isEmailSignInActive = computed(() => activeAuthentication.value?.method === 'email')
  const isGuestActive = computed(() => activeAuthentication.value?.method === 'guest')
  const isTwitchActive = computed(() => activeAuthentication.value?.method === 'twitch')

  const registrationTarget = computed(() => {
    const redirectTo = getRedirectNavigationTarget(route.query.redirectTo).path

    return {
      path: '/register',
      query: { redirectTo }
    }
  })

  const passwordRecoveryTarget = computed(() => {
    const redirectTo = getRedirectNavigationTarget(route.query.redirectTo).path

    return {
      path: '/forgot-password',
      query: { redirectTo }
    }
  })

  function getRequestStatus(error: unknown): number | undefined {
    if (error === null || typeof error !== 'object') {
      return
    }

    const statusCode = Reflect.get(error, 'statusCode')

    if (typeof statusCode === 'number') {
      return statusCode
    }

    const status = Reflect.get(error, 'status')

    return typeof status === 'number' ? status : undefined
  }

  function getEmailSignInErrorMessage(status: number | undefined): string {
    if (status === 401) {
      return 'Email or password is incorrect'
    } else if (status === 403) {
      return 'Security check failed. Try again.'
    } else if (status === 429) {
      return 'Too many sign-in attempts. Try again in a minute.'
    } else if (status === 503) {
      return 'Sign in is temporarily unavailable. Try again.'
    } else if (status === 409) {
      return 'A user is already signed in. Reload the page to continue.'
    }

    return 'Could not sign in. Try again.'
  }

  function getGuestErrorMessage(status: number | undefined): string {
    if (status === 403) {
      return 'Security check failed. Try again.'
    } else if (status === 429) {
      return 'Too many Guest attempts. Try again in a minute.'
    } else if (status === 503) {
      return 'Guest access is temporarily unavailable. Try again.'
    }

    return 'Could not continue as Guest. Try again.'
  }

  async function navigateAfterLogin(redirectTo: unknown) {
    const navigationTarget = getRedirectNavigationTarget(redirectTo)

    await navigateTo(navigationTarget.path, {
      replace: true,
      external: navigationTarget.external
    })
  }

  async function focusAfterAttempt(method: TurnstileAuthenticationMethod, focusPassword = false) {
    await nextTick()

    if (method === 'email') {
      if (focusPassword) {
        passwordInput.value?.focus()
      } else {
        signInButton.value?.focus()
      }
    } else if (method === 'guest') {
      guestButton.value?.focus()
    }
  }

  async function startTurnstileAuthentication(method: TurnstileAuthenticationMethod) {
    if (isAuthenticationBusy.value) {
      return
    }

    activeAuthentication.value = {
      method,
      phase: 'turnstile'
    }
    authenticationError.value = null

    if (method === 'guest') {
      passwordError.value = undefined
    }

    turnstileAction.value = method === 'email'
      ? emailSignInTurnstileAction
      : guestSessionTurnstileAction

    await nextTick()
    turnstileWidget.value?.execute()
  }

  function startEmailSignIn() {
    if (isAuthenticationBusy.value) {
      return
    }

    authenticationError.value = null
    passwordError.value = undefined

    if (!isEmailAuthenticationPasswordValid(password.value)) {
      passwordError.value = 'Use a password between 15 and 128 characters.'

      passwordInput.value?.focus()

      return
    }

    void startTurnstileAuthentication('email')
  }

  function continueAsGuest() {
    void startTurnstileAuthentication('guest')
  }

  async function cancelAuthentication() {
    const state = activeAuthentication.value

    if (state?.phase !== 'turnstile') {
      return
    }

    const { method } = state

    activeAuthentication.value = null

    await focusAfterAttempt(method)
  }

  async function handleVerificationError(message: string) {
    const state = activeAuthentication.value

    if (state?.phase !== 'turnstile') {
      return
    }

    const { method } = state

    activeAuthentication.value = null
    authenticationError.value = message

    await focusAfterAttempt(method)
  }

  async function finishEmailSignIn(token: string) {
    try {
      const responsePromise = requestFetch('/api/auth/email/sign-in', {
        method: 'POST',

        body: {
          email: email.value,
          password: password.value,
          [turnstileResponseFieldName]: token
        }
      })

      const response = await withMinimumDelay(responsePromise, 500)

      user.value.email = response.email
      user.value.userId = response.userId
      user.value.isAdmin = response.isAdmin
      user.value.isGuest = response.isGuest
      user.value.hasData = true

      await navigateAfterLogin(route.query.redirectTo)
    } catch (error) {
      const status = getRequestStatus(error)
      const focusPassword = status === 401

      authenticationError.value = getEmailSignInErrorMessage(status)
      activeAuthentication.value = null

      await focusAfterAttempt('email', focusPassword)
    }
  }

  async function finishGuestLogin(token: string) {
    try {
      const responsePromise = requestFetch('/api/auth/create-session', {
        body: {
          [turnstileResponseFieldName]: token
        },

        method: 'POST'
      })

      const response = await withMinimumDelay(responsePromise, 500)

      user.value.userId = response.userId
      user.value.isGuest = response.isGuest
      user.value.hasData = true

      await navigateAfterLogin(route.query.redirectTo)
    } catch (error) {
      const status = getRequestStatus(error)

      authenticationError.value = getGuestErrorMessage(status)
      activeAuthentication.value = null

      await focusAfterAttempt('guest')
    }
  }

  async function finishAuthentication(token: string) {
    const state = activeAuthentication.value

    if (state?.phase !== 'turnstile') {
      return
    }

    const { method } = state

    activeAuthentication.value = {
      method,
      phase: 'request'
    }

    const finish = method === 'email' ? finishEmailSignIn : finishGuestLogin

    await finish(token)
  }

  function redirectToTwitch() {
    if (isAuthenticationBusy.value) {
      return
    }

    activeAuthentication.value = {
      method: 'twitch',
      phase: 'redirect'
    }
    authenticationError.value = null
    passwordError.value = undefined

    const navigationTarget = getRedirectNavigationTarget(route.query.redirectTo)

    void navigateTo({
      path: '/api/oauth/twitch',

      query: {
        redirectTo: navigationTarget.path
      }
    }, {
      external: true
    })
  }
</script>

<style module>
  .form,
  .secondaryActions {
    display: grid;
    gap: var(--spacing-16);
  }

  .error {
    padding: var(--spacing-12);
    border-radius: var(--border-radius-12);
    background: var(--color-danger-subtle);
    color: var(--color-danger-primary);
    overflow-wrap: anywhere;
  }

  .divider {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--spacing-12);
    color: var(--color-text-muted);
    font-size: var(--font-size-14);
  }

  .dividerLine {
    block-size: 1px;
    background: var(--color-border-subtle);
  }
</style>
