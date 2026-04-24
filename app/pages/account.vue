<template>
  <PageContent page-title="Account">
    <div :class="$style.content">
      <AccountProfileCard
        :role="role"
        :user-id-text="userIdText"
        :user-initial="userInitial"
      />

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
  import AccountProfileCard from '~/components/account/AccountProfileCard.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import IconTitle from '~/components/IconTitle.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'

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

  .card:last-of-type {
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-danger), transparent 94%),
        var(--color-surface-base)
      );
  }
</style>
