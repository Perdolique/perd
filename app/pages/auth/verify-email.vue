<template>
  <AuthFormPanel title="Confirm your email" description="Enter the password you chose when requesting this email. To add email to an existing account, use the browser where you started.">
    <form v-if="hasToken" :class="$style.form" @submit.prevent="confirm">
      <TextInput
        ref="passwordInput"
        v-model="password"
        name="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        required
        :disabled="isPending"
        :error="passwordError"
      />
      <p v-if="errorMessage" :class="$style.error" role="alert">{{ errorMessage }}</p>
      <PerdButton type="submit" :loading="isPending" block>Confirm email</PerdButton>
    </form>
    <p v-else :class="$style.notice" role="status">Open the full verification link from your email to continue.</p>
    <PerdButton to="/register" variant="ghost">Request another email</PerdButton>
  </AuthFormPanel>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref, useTemplateRef } from 'vue'

  import {
    createError,
    definePageMeta,
    navigateTo,
    useRequestFetch,
    useRuntimeConfig,
    useRouter,
    useUserStore
  } from '#imports'

  import { isEmailRegistrationEnabled, isRegistrationPasswordValid } from '#shared/utils/email-registration'
  import { getRedirectNavigationTarget } from '~/utils/router'
  import { getEmailRegistrationError } from '~/utils/email-registration'
  import AuthFormPanel from '~/components/auth/AuthFormPanel.vue'
  import TextInput from '~/components/TextInput.vue'
  import PerdButton from '~/components/PerdButton.vue'

  definePageMeta({
    layout: false,
    skipAuth: true
  })

  const config = useRuntimeConfig()

  if (!isEmailRegistrationEnabled(config.public.emailRegistrationEnabled)) {
    throw createError({ statusCode: 404 })
  }

  const router = useRouter()
  const requestFetch = useRequestFetch()
  const { user } = useUserStore()
  const password = ref('')
  const passwordError = ref<string>()
  const errorMessage = ref<string | null>(null)
  const isPending = ref(false)
  const token = ref<string | null>(null)
  const hasToken = computed(() => token.value !== null)
  const passwordInput = useTemplateRef('passwordInput')

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
      token.value = candidate
    }

    await router.replace({ hash: '' })
  })

  async function confirm() {
    if (isPending.value || token.value === null) {
      return
    }

    passwordError.value = undefined
    errorMessage.value = null

    if (!isRegistrationPasswordValid(password.value)) {
      passwordError.value = 'Enter the password you chose, between 15 and 128 characters.'
      passwordInput.value?.focus()

      return
    }

    isPending.value = true

    try {
      const response = await requestFetch('/api/auth/email/registration/verify', {
        method: 'POST',

        body: {
          token: token.value,
          password: password.value
        }
      })

      user.value.userId = response.user.userId
      user.value.email = response.user.email
      user.value.isGuest = response.user.isGuest
      user.value.isAdmin = response.user.isAdmin
      user.value.hasData = true
      token.value = null
      password.value = ''

      const target = getRedirectNavigationTarget(response.redirectTo)

      await navigateTo(target.path, {
        replace: true,
        external: target.external
      })
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
    color: var(--color-text-secondary);
  }

  .error {
    color: var(--color-danger-primary);
  }
</style>
