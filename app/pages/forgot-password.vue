<template>
  <AuthFormPanel
    title="Reset your password"
    description="Enter the email address you use to sign in."
  >
    <p
      v-if="isAccepted"
      ref="acceptedStatus"
      :class="$style.notice"
      role="status"
      tabindex="-1"
    >
      If an account can use password recovery, an email may arrive soon. If it does not arrive, try again later.
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

      <p v-if="errorMessage" :class="$style.error" role="alert">{{ errorMessage }}</p>

      <PerdButton
        ref="submitButton"
        type="submit"
        :loading="isPending"
        block
      >
        {{ isAccepted ? 'Send another email' : 'Send reset email' }}
      </PerdButton>
    </form>

    <p :class="$style.navigation">
      <PerdLink :to="signInTarget" :disabled="isPending">Back to sign in</PerdLink>
    </p>

    <TurnstileWidget
      ref="turnstileWidget"
      :sitekey="turnstileSiteKey"
      :action="passwordRecoveryRequestTurnstileAction"
      @verified="requestRecovery"
      @error="verificationFailed"
      @cancel="verificationCancelled"
    />
  </AuthFormPanel>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useRequestFetch, useRoute, useRuntimeConfig } from '#imports'
  import { passwordRecoveryRequestTurnstileAction, turnstileResponseFieldName } from '#shared/utils/turnstile'
  import { getPasswordRecoveryRequestError } from '~/utils/password-recovery'
  import { getRedirectNavigationTarget } from '~/utils/router'
  import AuthFormPanel from '~/components/auth/AuthFormPanel.vue'
  import TurnstileWidget from '~/components/auth/TurnstileWidget.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import TextInput from '~/components/TextInput.vue'

  definePageMeta({
    layout: 'auth',
    skipAuth: true
  })

  const requestFetch = useRequestFetch()
  const route = useRoute()
  const runtimeConfig = useRuntimeConfig()
  const { turnstileSiteKey } = runtimeConfig.public
  const email = ref('')
  const errorMessage = ref<string | null>(null)
  const isAccepted = ref(false)
  const isPending = ref(false)
  const acceptedStatus = useTemplateRef('acceptedStatus')
  const submitButton = useTemplateRef('submitButton')
  const turnstileWidget = useTemplateRef('turnstileWidget')
  const redirectTo = computed(() => getRedirectNavigationTarget(route.query.redirectTo).path)

  const signInTarget = computed(() => {
    return {
      path: '/login',
      query: { redirectTo: redirectTo.value }
    }
  })

  function submit() {
    if (isPending.value) {
      return
    }

    errorMessage.value = null
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

  async function requestRecovery(token: string) {
    let shouldFocusSubmit = false

    try {
      await requestFetch('/api/auth/email/password-recovery', {
        method: 'POST',

        body: {
          email: email.value,
          redirectTo: redirectTo.value,
          [turnstileResponseFieldName]: token
        }
      })

      isAccepted.value = true

      await nextTick()
      acceptedStatus.value?.focus()
    } catch (error) {
      errorMessage.value = getPasswordRecoveryRequestError(error)
      shouldFocusSubmit = true
    } finally {
      isPending.value = false

      if (shouldFocusSubmit) {
        await nextTick()
        submitButton.value?.focus()
      }
    }
  }
</script>

<style module>
  @import '../assets/styles/auth-form.css';
</style>
