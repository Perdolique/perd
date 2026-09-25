<template>
  <PerdCard :class="$style.component">
    <PerdHeading :level="2">
      Sign-in methods
    </PerdHeading>

    <div
      v-if="isMethodsLoading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      :class="$style.message"
    >
      Loading sign-in methods…
    </div>

    <div v-else-if="hasMethodsError" role="alert" :class="$style.feedback">
      <p>Could not load sign-in methods. Try again.</p>

      <PerdButton size="small" variant="secondary" @click="emit('retry')">
        Retry
      </PerdButton>
    </div>

    <template v-else>
      <dl :class="$style.methods">
        <div :class="$style.method">
          <dt>Verified email</dt>
          <dd>{{ emailLabel }}</dd>
        </div>

        <div :class="$style.method">
          <dt>Twitch</dt>
          <dd>{{ twitchLabel }}</dd>
        </div>
      </dl>

      <p
        v-if="disconnectSuccess"
        ref="disconnectSuccessMessage"
        role="status"
        tabindex="-1"
        :class="$style.message"
      >
        Twitch was disconnected. You can connect it again at any time.
      </p>

      <p v-if="connectError" role="alert" :class="$style.error">
        {{ connectError }}
      </p>

      <p v-if="showDisconnectEmailRequirement" :class="$style.note">
        {{ disconnectEmailRequirement }}
      </p>

      <div v-if="showConnectionAction" :class="$style.actions">
        <PerdButton
          v-if="showConnectAction"
          icon="hugeicons:twitch"
          :loading="isConnecting"
          @click="emit('connect')"
        >
          Connect Twitch
        </PerdButton>

        <PerdButton
          v-else-if="showDisconnectAction"
          variant="danger"
          @click="emit('disconnect')"
        >
          Disconnect Twitch
        </PerdButton>
      </div>
    </template>
  </PerdCard>
</template>

<script lang="ts" setup>
  import { computed, useTemplateRef } from 'vue'
  import { twitchOAuthMessages } from '#shared/utils/twitch-oauth'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  interface Props {
    connectError: string | null;
    disconnectSuccess: boolean;
    email: string | null;
    emailRegistrationEnabled: boolean;
    isConnecting: boolean;
    isTwitchLinked: boolean;
    status: 'error' | 'loading' | 'ready';
  }

  interface Emits {
    connect: [];
    disconnect: [];
    retry: [];
  }

  const { email, emailRegistrationEnabled, isTwitchLinked, status } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const disconnectSuccessMessage = useTemplateRef('disconnectSuccessMessage')
  const isMethodsLoading = computed(() => status === 'loading')
  const hasMethodsError = computed(() => status === 'error')
  const emailLabel = computed(() => email ?? 'Not added')
  const twitchLabel = computed(() => isTwitchLinked ? 'Connected' : 'Not connected')

  const disconnectEmailRequirement = computed(() => emailRegistrationEnabled
    ? twitchOAuthMessages.disconnectEmailRequired
    : 'Twitch cannot be disconnected while email registration is unavailable.')

  const showConnectAction = computed(() => isTwitchLinked === false)
  const showDisconnectAction = computed(() => isTwitchLinked && email !== null)
  const showDisconnectEmailRequirement = computed(() => isTwitchLinked && email === null)
  const showConnectionAction = computed(() => showConnectAction.value || showDisconnectAction.value)

  function focusDisconnectSuccess() {
    disconnectSuccessMessage.value?.focus()
  }

  defineExpose({ focusDisconnectSuccess })
</script>

<style module>
  .component {
    display: grid;
    row-gap: var(--spacing-24);
    container-type: inline-size;
  }

  .methods {
    display: grid;
    gap: var(--spacing-16);

    @container (inline-size >= 40rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .method {
    display: grid;
    row-gap: var(--spacing-8);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);

    dt {
      color: var(--color-text-muted);
      font-size: var(--font-size-12);
      font-weight: var(--font-weight-medium);
      letter-spacing: var(--letter-spacing-label);
      text-transform: uppercase;
    }

    dd {
      font-size: var(--font-size-14);
      overflow-wrap: anywhere;
    }
  }

  .message:focus-visible {
    border-radius: var(--border-radius-8);
  }

  .feedback {
    display: grid;
    justify-items: start;
    gap: var(--spacing-16);
  }

  .error {
    color: var(--color-danger-primary);
  }

  .note {
    color: var(--color-text-tertiary);
  }

  .actions {
    display: flex;
  }
</style>
