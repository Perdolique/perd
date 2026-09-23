<template>
  <PerdCard :class="$style.component">
    <PerdHeading :level="2">Passkeys</PerdHeading>
    <p>Sign in with your device unlock or a security key. Keep email or Twitch for account recovery.</p>

    <p v-if="isLoading" role="status">Loading passkeys…</p>
    <div v-if="loadError" :class="$style.feedback" role="alert">
      <p>{{ loadError }}</p>
      <PerdButton size="small" variant="secondary" @click="retryLoadPasskeys">Retry</PerdButton>
    </div>

    <p v-if="hasGuestNotice">Add a verified email or connect Twitch using the account actions to add a passkey.</p>
    <p v-if="isEmpty">No passkeys added yet.</p>

    <ul v-if="hasPasskeys" :class="$style.list" aria-label="Your passkeys">
      <li v-for="passkey in passkeys" :key="passkey.id" :class="$style.entry">
        <div :class="$style.details">
          <strong>{{ passkey.name }}</strong>
          <span>Added {{ formatDate(passkey.createdAt) }}</span>
          <span>{{ lastUsedLabel(passkey.lastUsedAt) }}</span>
        </div>
        <div :class="$style.actions">
          <PerdButton size="small" variant="secondary" :disabled="isBusy" @click="editPasskey(passkey)">Rename</PerdButton>
          <PerdButton size="small" variant="danger" :disabled="isBusy" @click="confirmRemoval(passkey)">Remove</PerdButton>
        </div>
      </li>
    </ul>

    <p v-if="showUnsupported">{{ passkeyMessages.unsupported }}</p>
    <form v-if="showAddForm" :class="$style.form" @submit.prevent="registerPasskey">
      <TextInput
        ref="nameInput"
        v-model="name"
        name="passkey-name"
        label="Passkey name"
        placeholder="For example, MacBook or security key"
        :maxlength="64"
        :disabled="isBusy"
        :error="nameError"
        required
      />
      <div :class="$style.actions">
        <PerdButton type="submit" :loading="isRegistering" :disabled="isBusy">Add passkey</PerdButton>
        <PerdButton v-if="canCancelRegistration" variant="secondary" @click="cancelRegistration">Cancel</PerdButton>
      </div>
    </form>

    <p v-if="message" ref="feedback" :class="$style.feedback" :role="messageRole" tabindex="-1">{{ message }}</p>

    <ConfirmationDialog
      v-model="showRename"
      header-text="Rename passkey"
      confirm-button-text="Save name"
      :close-on-confirm="false"
      :confirm-disabled="isRenameDisabled"
      :confirm-loading="isSaving"
      :error="dialogError"
      @confirm="renamePasskey"
    >
      <form @submit.prevent="renamePasskey">
        <TextInput v-model="editedName" name="passkey-new-name" label="Passkey name" :maxlength="64" :disabled="isSaving" required />
      </form>
    </ConfirmationDialog>

    <ConfirmationDialog
      v-model="showRemove"
      header-text="Remove passkey"
      confirm-button-text="Remove passkey"
      confirm-variant="danger"
      :close-on-confirm="false"
      :confirm-loading="isSaving"
      :error="dialogError"
      @confirm="removePasskey"
    >
      Remove “{{ selectedPasskey?.name }}”? It will no longer work for sign-in. Your other passkeys, email, and Twitch stay available.
    </ConfirmationDialog>
  </PerdCard>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
  import { useRequestFetch } from '#imports'
  import type { PasskeySummary } from '#shared/types/passkey'
  import { passkeyMessages } from '#shared/utils/passkey'
  import { getPasskeyErrorMessage, getPasskeyRequestStatus, isPasskeyCancellation } from '~/utils/passkey'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import TextInput from '~/components/TextInput.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'

  type PasskeyLoadOutcome = 'aborted' | 'failed' | 'loaded'

  const defaultLoadError = 'Could not load passkeys. Reload the list before trying again.'
  const uncertainRegistrationLoadError = 'The passkey may have been added, but the list could not be reloaded. Retry before adding it again.'
  const requestFetch = useRequestFetch()
  const passkeys = ref<PasskeySummary[]>([])
  const canRegister = ref(false)
  const hasLoaded = ref(false)
  const supported = ref(false)
  const isLoading = ref(true)
  const isSaving = ref(false)
  const registrationPhase = ref<'idle' | 'options' | 'authenticator' | 'verify'>('idle')
  const name = ref('')
  const nameError = ref<string>()
  const editedName = ref('')
  const selectedPasskey = ref<PasskeySummary | null>(null)
  const showRename = ref(false)
  const showRemove = ref(false)
  const dialogError = ref<string | null>(null)
  const loadError = ref<string | null>(null)
  const message = ref<string | null>(null)
  const messageRole = ref<'alert' | 'status'>('status')
  const nameInput = useTemplateRef('nameInput')
  const feedback = useTemplateRef('feedback')
  const isRegistering = computed(() => registrationPhase.value !== 'idle')
  const isBusy = computed(() => isRegistering.value || isSaving.value || isLoading.value)
  const hasPasskeys = computed(() => passkeys.value.length > 0)
  const isEmpty = computed(() => hasLoaded.value && !hasPasskeys.value && canRegister.value)
  const hasGuestNotice = computed(() => hasLoaded.value && !canRegister.value)
  const showAddForm = computed(() => hasLoaded.value && canRegister.value && supported.value && !loadError.value)
  const showUnsupported = computed(() => hasLoaded.value && canRegister.value && !supported.value)
  const canCancelRegistration = computed(() => registrationPhase.value === 'options' || registrationPhase.value === 'authenticator')
  const isRenameDisabled = computed(() => editedName.value.trim().length === 0 || isSaving.value)
  let attempt = 0
  let disposed = false
  let optionsController: AbortController | null = null
  let listController: AbortController | null = null

  function formatDate(value: string) {
    const date = new Date(value)

    return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
  }

  function lastUsedLabel(value: string | null) {
    return value === null ? 'Never used' : `Last used ${formatDate(value)}`
  }

  async function announce(text: string, isError = false) {
    if (disposed) {
      return
    }

    messageRole.value = isError ? 'alert' : 'status'
    message.value = text

    await nextTick()
    feedback.value?.focus()
  }

  async function loadPasskeys(failureMessage = defaultLoadError): Promise<PasskeyLoadOutcome> {
    listController?.abort()

    const controller = new globalThis.AbortController()

    listController = controller
    isLoading.value = true

    try {
      const response = await requestFetch('/api/account/passkeys', {
        signal: controller.signal,
        retry: 0
      })

      if (disposed || listController !== controller) {
        return 'aborted'
      }

      passkeys.value = response.items
      canRegister.value = response.canRegister
      hasLoaded.value = true
      loadError.value = null

      return 'loaded'
    } catch {
      if (!disposed && !controller.signal.aborted) {
        loadError.value = failureMessage

        return 'failed'
      }

      return 'aborted'
    } finally {
      if (listController === controller) {
        isLoading.value = false
      }
    }
  }

  async function retryLoadPasskeys() {
    if (isLoading.value) {
      return
    }

    const outcome = await loadPasskeys()

    if (outcome === 'loaded') {
      await announce('Passkeys loaded.')
    }
  }

  async function cancelRegistration() {
    attempt += 1

    optionsController?.abort()

    registrationPhase.value = 'idle'

    await nextTick()

    if (!disposed) {
      nameInput.value?.focus()
    }
  }

  async function registerPasskey() {
    if (isBusy.value) {
      return
    }

    const trimmedName = name.value.trim()

    if (!trimmedName) {
      nameError.value = 'Enter a name for this passkey.'

      nameInput.value?.focus()

      return
    }

    nameError.value = undefined
    message.value = null
    attempt += 1

    const currentAttempt = attempt

    optionsController = new globalThis.AbortController()
    registrationPhase.value = 'options'

    try {
      const response = await requestFetch('/api/account/passkeys/registration/options', {
        method: 'POST',
        body: { name: trimmedName },
        signal: optionsController.signal,
        retry: 0
      })

      if (currentAttempt !== attempt || disposed) {
        return
      }

      registrationPhase.value = 'authenticator'

      const publicKey = globalThis.PublicKeyCredential.parseCreationOptionsFromJSON(response.options)

      const credential = await globalThis.navigator.credentials.create({
        publicKey,
        signal: optionsController.signal
      })

      if (!(credential instanceof globalThis.PublicKeyCredential)) {
        throw new Error('Passkey registration returned no credential')
      }

      const credentialJSON = credential.toJSON()

      if (!('attestationObject' in credentialJSON.response)) {
        throw new Error('Passkey registration returned an invalid credential')
      }

      if (currentAttempt !== attempt || disposed) {
        return
      }

      registrationPhase.value = 'verify'

      const saved = await requestFetch('/api/account/passkeys/registration/verify', {
        method: 'POST',

        body: {
          ceremonyId: response.ceremonyId,
          credential: credentialJSON
        },

        retry: 0
      })

      if (!disposed) {
        passkeys.value.push(saved)

        name.value = ''

        await announce('Passkey added. You can use it the next time you sign in.')
      }
    } catch (error) {
      if (currentAttempt !== attempt || disposed) {
        return
      }

      const status = getPasskeyRequestStatus(error)

      if (registrationPhase.value === 'verify' && (status === undefined || status >= 500)) {
        const outcome = await loadPasskeys(uncertainRegistrationLoadError)

        if (outcome === 'loaded') {
          await announce('The result could not be confirmed. Check the refreshed list before adding this passkey again.', true)
        }
      } else {
        const errorMessage = getPasskeyErrorMessage(error)

        await announce(errorMessage, !isPasskeyCancellation(error))
      }
    } finally {
      if (currentAttempt === attempt) {
        registrationPhase.value = 'idle'
      }
    }
  }

  function editPasskey(passkey: PasskeySummary) {
    selectedPasskey.value = passkey
    editedName.value = passkey.name
    dialogError.value = null
    showRename.value = true
  }

  function confirmRemoval(passkey: PasskeySummary) {
    selectedPasskey.value = passkey
    dialogError.value = null
    showRemove.value = true
  }

  async function renamePasskey() {
    const selected = selectedPasskey.value

    if (selected === null || isRenameDisabled.value) {
      return
    }

    isSaving.value = true
    dialogError.value = null

    try {
      const saved = await requestFetch(`/api/account/passkeys/${selected.id}`, {
        method: 'PATCH',
        body: { name: editedName.value.trim() },
        retry: 0
      })

      passkeys.value = passkeys.value.map(passkey => passkey.id === saved.id ? saved : passkey)
      showRename.value = false

      await announce('Passkey renamed.')
    } catch {
      const outcome = await loadPasskeys()
      const updated = passkeys.value.find(passkey => passkey.id === selected.id)

      if (outcome === 'loaded' && updated?.name === editedName.value.trim()) {
        showRename.value = false

        await announce('Passkey renamed.')
      } else {
        dialogError.value = 'Could not confirm the new name. Check the list and try again.'
      }
    } finally {
      isSaving.value = false
    }
  }

  async function removePasskey() {
    const selected = selectedPasskey.value

    if (selected === null || isSaving.value) {
      return
    }

    isSaving.value = true
    dialogError.value = null

    try {
      await requestFetch(`/api/account/passkeys/${selected.id}`, {
        method: 'DELETE',
        retry: 0
      })

      passkeys.value = passkeys.value.filter(passkey => passkey.id !== selected.id)
      showRemove.value = false

      await announce('Passkey removed. Your other sign-in methods are still available.')
    } catch {
      const outcome = await loadPasskeys()

      if (outcome === 'loaded' && !passkeys.value.some(passkey => passkey.id === selected.id)) {
        showRemove.value = false

        await announce('Passkey removed. Your other sign-in methods are still available.')
      } else {
        dialogError.value = 'Could not confirm removal. Check the list and try again.'
      }
    } finally {
      isSaving.value = false
    }
  }

  onMounted(() => {
    supported.value = typeof globalThis.PublicKeyCredential === 'function'
    void loadPasskeys()
  })

  onBeforeUnmount(() => {
    disposed = true

    void cancelRegistration()

    listController?.abort()
  })
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-16);
  }

  .list {
    display: grid;
    gap: var(--spacing-16);
    padding: 0;
    list-style: none;
  }

  .entry {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    border-block-end: 1px solid var(--color-border-subtle);
    padding-block-end: var(--spacing-16);
  }

  .details {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-8);
  }

  .form {
    display: grid;
    gap: var(--spacing-12);
  }

  .feedback {
    display: grid;
    gap: var(--spacing-8);
    overflow-wrap: anywhere;
  }
</style>
