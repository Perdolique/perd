<template>
  <PageContent page-title="Account">
    <div :class="$style.content">
      <AccountProfileCard
        :role="role"
        :user-id-text="userIdText"
        :user-initial="userInitial"
        @logout="handleLogout"
      />

      <p
        v-if="twitchLinkOutcome"
        ref="twitchLinkBanner"
        :class="[$style.banner, { error: isTwitchConflict }]"
        :role="twitchLinkRole"
        tabindex="-1"
      >
        {{ twitchLinkMessage }}
      </p>

      <AccountSignInMethods
        ref="signInMethodsCard"
        :connect-error="twitchConnectError"
        :disconnect-success="twitchDisconnectSuccess"
        :email="user.email"
        :email-registration-enabled="registrationEnabled"
        :is-connecting="isConnectingTwitch"
        :is-twitch-linked="user.isTwitchLinked"
        :status="signInMethodsStatus"
        @connect="connectTwitch"
        @disconnect="openDisconnectTwitchDialog"
        @retry="loadSignInMethods"
      />

      <ActionPanel
        v-if="canAddEmail"
        icon="hugeicons:mail-01"
        title="Add email"
        subtitle="Keep access to your account with a verified email and password."
        to="/register?redirectTo=/account"
      />

      <AccountPasskeys />

      <ActionPanel
        icon="hugeicons:task-daily-01"
        subtitle="Track pending, published, and rejected catalog contributions."
        title="My contributions"
        :to="appRoutes.accountSubmissions"
      />

      <ActionPanel
        v-if="isAdmin"
        icon="hugeicons:settings-02"
        subtitle="Review pending catalog contributions."
        title="Admin"
        :to="appRoutes.admin"
      />

      <DangerActionCard
        title="Danger"
        action-text="Delete Account"
        @action="onDeleteClick"
      />
    </div>

    <ConfirmationDialog
      v-model="showDisconnectTwitchModal"
      header-text="Disconnect Twitch"
      confirm-button-text="Disconnect Twitch"
      confirm-variant="danger"
      :close-on-confirm="false"
      :confirm-loading="isDisconnectingTwitch"
      :error="twitchDisconnectError"
      @confirm="disconnectTwitch"
    >
      You will no longer be able to sign in with Twitch. Your account and data will stay available through your verified email.
    </ConfirmationDialog>

    <ConfirmationDialog
      v-model="showDeleteModal"
      header-text="Delete account"
      confirm-button-text="Delete account"
      confirm-variant="danger"
      @confirm="handleDeleteAccount"
    >
      Are you sure you want to delete your account? This action cannot be undone.
    </ConfirmationDialog>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
  import { definePageMeta, navigateTo, useRequestFetch, useRoute, useRuntimeConfig, useUserStore } from '#imports'
  import { isEmailRegistrationEnabled } from '#shared/utils/email-registration'
  import { getTwitchDisconnectError } from '~/utils/twitch-oauth'
  import { useGearLibraryStore } from '~/stores/gear-library'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import AccountProfileCard from '~/components/account/AccountProfileCard.vue'
  import AccountSignInMethods from '~/components/account/AccountSignInMethods.vue'
  import AccountPasskeys from '~/components/account/AccountPasskeys.vue'
  import ActionPanel from '~/components/ActionPanel.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import DangerActionCard from '~/components/DangerActionCard.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes } from '~/utils/navigation'

  definePageMeta({
    layout: 'page'
  })

  const { user, resetAuthentication } = useUserStore()
  const gearLibraryStore = useGearLibraryStore()
  const packingListsStore = usePackingListsStore()
  const requestFetch = useRequestFetch()
  const route = useRoute()
  const showDeleteModal = ref(false)
  const showDisconnectTwitchModal = ref(false)
  const isDeleting = ref(false)
  const isConnectingTwitch = ref(false)
  const isDisconnectingTwitch = ref(false)
  const isLoadingSignInMethods = ref(true)
  const hasSignInMethodsError = ref(false)
  const hasHandledTwitchLinkOutcome = ref(false)
  const twitchConnectError = ref<string | null>(null)
  const twitchDisconnectError = ref<string | null>(null)
  const twitchDisconnectSuccess = ref(false)
  const twitchLinkBanner = useTemplateRef<HTMLElement>('twitchLinkBanner')
  const signInMethodsCard = useTemplateRef('signInMethodsCard')
  const registrationEnabled = isEmailRegistrationEnabled(useRuntimeConfig().public.emailRegistrationEnabled)
  const canAddEmail = computed(() => registrationEnabled && user.value.email === null)
  const role = computed(() => user.value.isAdmin ? 'Admin' : 'User')
  const isAdmin = computed(() => user.value.isAdmin)
  const userIdText = computed(() => user.value.userId ?? '')
  const userInitial = computed(() => userIdText.value.slice(0, 1).toUpperCase() || 'P')

  const signInMethodsStatus = computed(() => {
    if (isLoadingSignInMethods.value) {
      return 'loading' as const
    }

    return hasSignInMethodsError.value ? 'error' as const : 'ready' as const
  })

  const requestedTwitchLinkOutcome = computed(() => {
    const value = route.query.twitchLink

    return value === 'success' || value === 'conflict' ? value : null
  })

  const twitchLinkOutcome = computed(() => {
    if (requestedTwitchLinkOutcome.value === 'success') {
      return signInMethodsStatus.value === 'ready' && user.value.isTwitchLinked
        ? 'success'
        : null
    }

    return requestedTwitchLinkOutcome.value
  })

  const isTwitchConflict = computed(() => twitchLinkOutcome.value === 'conflict')
  const twitchLinkRole = computed(() => isTwitchConflict.value ? 'alert' : 'status')

  const twitchLinkMessage = computed(() => {
    if (twitchLinkOutcome.value === 'success') {
      return 'Twitch is now connected to this account.'
    }

    return 'This Twitch account is already connected to another account. Your current account and its data were not changed.'
  })

  async function showTwitchLinkOutcome() {
    if (
      hasHandledTwitchLinkOutcome.value
      || requestedTwitchLinkOutcome.value === null
      || (requestedTwitchLinkOutcome.value === 'success' && hasSignInMethodsError.value)
    ) {
      return
    }

    await nextTick()

    if (twitchLinkOutcome.value !== null) {
      twitchLinkBanner.value?.focus()
    }

    const cleanUrl = new globalThis.URL(globalThis.location.href)

    cleanUrl.searchParams.delete('twitchLink')
    globalThis.history.replaceState(globalThis.history.state, '', cleanUrl)

    hasHandledTwitchLinkOutcome.value = true
  }

  async function loadSignInMethods() {
    isLoadingSignInMethods.value = true
    hasSignInMethodsError.value = false

    try {
      const response = await requestFetch('/api/user', { retry: 0 })

      user.value.email = response.email
      user.value.userId = response.userId
      user.value.isAdmin = response.isAdmin
      user.value.isGuest = response.isGuest
      user.value.isTwitchLinked = response.isTwitchLinked
      user.value.hasData = true
    } catch {
      hasSignInMethodsError.value = true
    } finally {
      isLoadingSignInMethods.value = false

      await showTwitchLinkOutcome()
    }
  }

  async function connectTwitch() {
    if (isConnectingTwitch.value) {
      return
    }

    isConnectingTwitch.value = true
    twitchConnectError.value = null

    try {
      const response = await requestFetch('/api/oauth/twitch', {
        retry: 0,

        query: {
          intent: 'link',
          redirectTo: '/account',
          responseMode: 'json'
        }
      })

      if (response === undefined) {
        throw new Error('Missing Twitch authorization response')
      }

      await navigateTo(response.authorizationUrl, { external: true })
    } catch {
      twitchConnectError.value = 'Could not start the Twitch connection. Try again.'
    } finally {
      isConnectingTwitch.value = false
    }
  }

  function openDisconnectTwitchDialog() {
    twitchDisconnectError.value = null
    showDisconnectTwitchModal.value = true
  }

  async function disconnectTwitch() {
    if (isDisconnectingTwitch.value) {
      return
    }

    isDisconnectingTwitch.value = true
    twitchDisconnectError.value = null

    try {
      const response = await requestFetch('/api/oauth/twitch', {
        method: 'DELETE',
        retry: 0
      })

      user.value.isTwitchLinked = response.isTwitchLinked
      twitchDisconnectSuccess.value = true
      showDisconnectTwitchModal.value = false

      await nextTick()
      globalThis.requestAnimationFrame(() => signInMethodsCard.value?.focusDisconnectSuccess())
    } catch (error) {
      twitchDisconnectError.value = getTwitchDisconnectError(error)
    } finally {
      isDisconnectingTwitch.value = false
    }
  }

  function onDeleteClick() {
    showDeleteModal.value = true
  }

  async function handleLogout() {
    await requestFetch('/api/auth/logout', {
      method: 'POST'
    })

    resetAuthentication()
    packingListsStore.clearPackingLists()
    gearLibraryStore.resetPersonalizedState()

    await navigateTo({
      path: '/login'
    })
  }

  async function handleDeleteAccount() {
    if (isDeleting.value) {
      return
    }

    try {
      isDeleting.value = true

      await requestFetch('/api/account', {
        method: 'DELETE'
      })

      resetAuthentication()
      packingListsStore.clearPackingLists()
      gearLibraryStore.resetPersonalizedState()

      await navigateTo({
        path: '/login'
      })
    } catch (error) {
      console.error('Failed to delete account:', error)
    } finally {
      isDeleting.value = false
    }
  }

  onMounted(() => {
    void loadSignInMethods()
  })
</script>

<style module>
  .content {
    display: grid;
    row-gap: var(--spacing-24);
  }

  .banner {
    padding: var(--spacing-16);
    border: 1px solid var(--color-accent-subtle-border);
    border-radius: var(--border-radius-16);
    background: var(--color-accent-subtle);
    &:global(.error) {
      border-color: var(--color-danger-border);
      background: var(--color-danger-subtle);
      color: var(--color-danger-primary);
    }
  }

</style>
