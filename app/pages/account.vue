<template>
  <PageContent page-title="Account">
    <div :class="$style.content">
      <AccountProfileCard
        :role="role"
        :user-id-text="userIdText"
        :user-initial="userInitial"
        @logout="handleLogout"
      />

      <DangerActionCard
        action-id="delete-account-dialog-invoker"
        title="Danger"
        action-text="Delete Account"
        @action="onDeleteClick"
      />
    </div>

    <ConfirmationDialog
      v-model="showDeleteModal"
      header-text="Delete account"
      confirm-button-text="Delete account"
      confirm-variant="danger"
      invoker-id="delete-account-dialog-invoker"
      @confirm="handleDeleteAccount"
    >
      Are you sure you want to delete your account? This action cannot be undone.
    </ConfirmationDialog>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, navigateTo, useRequestFetch, useUserStore } from '#imports'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import AccountProfileCard from '~/components/account/AccountProfileCard.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import DangerActionCard from '~/components/DangerActionCard.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const { user, resetAuthentication } = useUserStore()
  const packingListsStore = usePackingListsStore()
  const requestFetch = useRequestFetch()
  const showDeleteModal = ref(false)
  const isDeleting = ref(false)
  const role = computed(() => user.value.isAdmin ? 'Admin' : 'User')
  const userIdText = computed(() => user.value.userId ?? '')
  const userInitial = computed(() => userIdText.value.slice(0, 1).toUpperCase() || 'P')

  function onDeleteClick() {
    showDeleteModal.value = true
  }

  async function handleLogout() {
    await requestFetch('/api/auth/logout', {
      method: 'POST'
    })

    resetAuthentication()
    packingListsStore.clearPackingLists()

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

</style>
