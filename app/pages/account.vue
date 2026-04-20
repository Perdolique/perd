<template>
  <PageContent page-title="Account">
    <div :class="$style.content">
      <PerdCard :class="$style.card">
        <div :class="$style.profileHeader">
          <span :class="$style.avatar" aria-hidden="true">
            {{ userInitial }}
          </span>

          <div :class="$style.profileIntro">
            <p :class="$style.eyebrow">
              Field profile
            </p>

            <PerdHeading :level="2">
              Profile Information
            </PerdHeading>
          </div>
        </div>

        <div :class="$style.infoBlock">
          <div :class="$style.infoItem">
            <span :class="$style.label">
              User ID
            </span>

            <span :class="$style.value">
              {{ userIdText }}
            </span>
          </div>

          <div :class="$style.infoItem">
            <span :class="$style.label">
              Role
            </span>

            <span :class="$style.value">
              {{ role }}
            </span>
          </div>
        </div>
      </PerdCard>

      <PerdCard :class="$style.card">
        <IconTitle
          icon="tabler:alert-triangle"
          :level="2"
        >
          Danger Zone
        </IconTitle>

        <PerdButton
          variant="danger"
          icon="tabler:trash"
          @click="onDeleteClick"
        >
          Delete Account
        </PerdButton>
      </PerdCard>
    </div>

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
  import { computed, ref } from 'vue'
  import { $fetch } from 'ofetch'
  import { definePageMeta, navigateTo, useUserStore } from '#imports'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import IconTitle from '~/components/IconTitle.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  definePageMeta({
    layout: 'page'
  })

  const { user, resetAuthentication } = useUserStore()
  const showDeleteModal = ref(false)
  const isDeleting = ref(false)
  const role = computed(() => user.value.isAdmin ? 'Admin' : 'User')
  const userIdText = computed(() => user.value.userId ?? '')
  const userInitial = computed(() => userIdText.value.slice(0, 1).toUpperCase() || 'P')

  function onDeleteClick() {
    showDeleteModal.value = true
  }

  async function handleDeleteAccount() {
    if (isDeleting.value) {
      return
    }

    try {
      isDeleting.value = true

      await $fetch('/api/account', {
        method: 'DELETE'
      })

      resetAuthentication()

      await navigateTo({
        path: '/login'
      })
    } catch (error) {
      console.error('Failed to delete account:', error)
    } finally {
      isDeleting.value = false
    }
  }
</script>

<style module>
  .content {
    display: grid;
    row-gap: var(--spacing-24);
  }

  .card {
    display: grid;
    row-gap: var(--spacing-24);
  }

  .profileHeader {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-16);
    align-items: center;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 4rem;
    height: 4rem;
    border-radius: 999px;
    background: var(--color-accent-subtle);
    color: var(--color-accent-base);
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-bold);
  }

  .profileIntro {
    display: grid;
    gap: var(--spacing-8);
  }

  .eyebrow {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .infoBlock {
    display: grid;
    row-gap: var(--spacing-16);

    @media (width >= 640px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: var(--spacing-16);
    }
  }

  .infoItem {
    display: grid;
    row-gap: var(--spacing-8);
    justify-content: start;
    padding: var(--spacing-16);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-subtle);
    border: 1px solid var(--color-border-subtle);
  }

  .label {
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .value {
    font-size: var(--font-size-14);
    color: var(--color-text-primary);
  }

  .card:last-of-type {
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-danger), transparent 94%),
        var(--color-surface-base)
      );
  }
</style>
