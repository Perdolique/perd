<template>
  <AuthFormPanel :title="title">
    <p v-if="isSent" ref="sentMessage" :class="$style.notice" role="status" tabindex="-1">
      Check your email for the next step. Verification links expire in one hour.
      To send another email, enter your password again.
    </p>

    <form :class="$style.form" @submit.prevent="submit">
      <TextInput
        v-model="email"
        name="email"
        label="Email"
        type="email"
        autocomplete="email"
        :maxlength="254"
        required
        :disabled="isPending"
      />
      <TextInput
        ref="passwordInput"
        v-model="password"
        name="password"
        label="Password"
        type="password"
        autocomplete="new-password"
        hint="Use 15–128 characters. Spaces and passphrases are welcome."
        :error="passwordError"
        required
        :disabled="isPending"
      />
      <p v-if="errorMessage" :class="$style.error" role="alert">{{ errorMessage }}</p>
      <PerdButton ref="submitButton" type="submit" :loading="isPending" :disabled="!isAccountReady" block>{{ submitLabel }}</PerdButton>
    </form>

    <PerdButton :to="backPath" variant="ghost">{{ backLabel }}</PerdButton>
    <TurnstileWidget
      ref="turnstileWidget"
      :sitekey="siteKey"
      :action="emailRegistrationTurnstileAction"
      @verified="sendRegistration"
      @error="verificationFailed"
      @cancel="verificationCancelled"
    />
  </AuthFormPanel>
</template>

<script lang="ts" setup>
  import { FetchError } from 'ofetch'
  import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'

  import {
    createError,
    definePageMeta,
    navigateTo,
    useRequestFetch,
    useRoute,
    useRuntimeConfig,
    useUserStore
  } from '#imports'

  import { isEmailRegistrationEnabled, isRegistrationPasswordValid } from '#shared/utils/email-registration'
  import { emailRegistrationTurnstileAction, turnstileResponseFieldName } from '#shared/utils/turnstile'
  import { sanitizeRedirectPath } from '#shared/utils/redirect'
  import AuthFormPanel from '~/components/auth/AuthFormPanel.vue'
  import TurnstileWidget from '~/components/auth/TurnstileWidget.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import TextInput from '~/components/TextInput.vue'
  import { getEmailRegistrationError } from '~/utils/email-registration'

  definePageMeta({
    layout: 'auth',
    skipAuth: true
  })

  const config = useRuntimeConfig()

  if (!isEmailRegistrationEnabled(config.public.emailRegistrationEnabled)) {
    throw createError({ statusCode: 404 })
  }

  const requestFetch = useRequestFetch()
  const route = useRoute()
  const { user } = useUserStore()
  const email = ref('')
  const password = ref('')
  const passwordError = ref<string>()
  const errorMessage = ref<string | null>(null)
  const isAccountReady = ref(user.value.hasData)
  const isPending = ref(false)
  const isChecking = ref(false)
  const isSent = ref(false)
  const siteKey = config.public.turnstileSiteKey
  const turnstileWidget = useTemplateRef('turnstileWidget')
  const passwordInput = useTemplateRef('passwordInput')
  const submitButton = useTemplateRef('submitButton')
  const sentMessage = useTemplateRef('sentMessage')
  const isUpgrade = computed(() => user.value.userId !== null)
  const title = computed(() => isUpgrade.value ? 'Add email access' : 'Create your account')
  const submitLabel = computed(() => isSent.value ? 'Send another email' : 'Send verification email')
  const backPath = computed(() => isUpgrade.value ? '/account' : '/login')
  const backLabel = computed(() => isUpgrade.value ? 'Back to Account' : 'Back to sign in')

  onMounted(async () => {
    if (!user.value.hasData) {
      try {
        const currentUser = await requestFetch('/api/user')

        user.value.userId = currentUser.userId
        user.value.email = currentUser.email
        user.value.isAdmin = currentUser.isAdmin
        user.value.isGuest = currentUser.isGuest
        user.value.hasData = true
      } catch (error) {
        if (!(error instanceof FetchError) || error.statusCode !== 401) {
          errorMessage.value = 'Could not load your account. Reload this page to try again.'

          return
        }
      }
    }

    isAccountReady.value = true

    if (user.value.email !== null) {
      await navigateTo('/account', { replace: true })
    }
  })

  function submit() {
    if (isPending.value || !isAccountReady.value) {
      return
    }

    errorMessage.value = null
    passwordError.value = undefined

    if (!isRegistrationPasswordValid(password.value)) {
      passwordError.value = 'Use a password between 15 and 128 characters.'

      passwordInput.value?.focus()

      return
    }

    isPending.value = true
    isChecking.value = true

    turnstileWidget.value?.execute()
  }

  async function verificationCancelled() {
    isChecking.value = false
    isPending.value = false

    await nextTick()
    submitButton.value?.focus()
  }

  async function verificationFailed(message: string) {
    errorMessage.value = message

    await verificationCancelled()
  }

  async function sendRegistration(token: string) {
    if (!isChecking.value) {
      return
    }

    isChecking.value = false

    const redirectTo = sanitizeRedirectPath(route.query.redirectTo)

    try {
      await requestFetch('/api/auth/email/registration', {
        method: 'POST',

        body: {
          email: email.value,
          password: password.value,
          redirectTo,
          [turnstileResponseFieldName]: token
        }
      })

      password.value = ''
      passwordError.value = undefined
      isSent.value = true

      await nextTick()
      sentMessage.value?.focus()
    } catch (error) {
      errorMessage.value = getEmailRegistrationError(error)
    } finally {
      isPending.value = false
    }
  }
</script>

<style module>
  .form {
    display: grid;
    gap: var(--spacing-16);
  }

  .notice {
    padding: var(--spacing-16);
    border-radius: var(--border-radius-12);
    background: var(--color-success-subtle);
    overflow-wrap: anywhere;
  }

  .error {
    color: var(--color-danger-primary);
  }
</style>
