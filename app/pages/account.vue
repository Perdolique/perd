<template>
  <PageContent page-title="Account">
    <div :class="$style.content">
      <PerdCard :class="$style.card">
        <IconTitle
          icon="tabler:user"
          :level="2"
        >
          Profile Information
        </IconTitle>

        <div :class="$style.infoBlock">
          <div :class="$style.infoItem">
            <span :class="$style.label">
              User ID
            </span>

            <span :class="$style.value">
              {{ user.userId }}
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
          secondary
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
      @confirm="handleDeleteAccount"
    >
      Are you sure you want to delete your account? This action cannot be undone.
    </ConfirmationDialog>
  </PageContent>
</template>

<script lang="ts" setup>
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import IconTitle from '~/components/IconTitle.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'

  definePageMeta({
    layout: 'page'
  })

  const { user, resetAuthentication } = useUserStore()
  const { showErrorToast } = useApiErrorToast()
  const { addToast } = useToaster()
  const showDeleteModal = ref(false)
  const isDeleting = ref(false)
  const role = computed(() => user.value.isAdmin ? 'Admin' : 'User')

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

      addToast({
        title: 'Account deleted',
        message: 'Bye! 👋'
      })

      resetAuthentication()

      await navigateTo({
        path: '/login'
      })
    } catch (error) {
      showErrorToast(error, 'Failed to delete account')
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
    justify-content: start;
  }

  .infoBlock {
    display: grid;
    row-gap: var(--spacing-16);
  }

  .infoItem {
    display: grid;
    row-gap: var(--spacing-8);
    justify-content: start;
  }

  .label {
    font-size: var(--font-size-16);
    font-weight: var(--font-weight-medium);
  }

  .value {
    font-size: var(--font-size-14);
    color: var(--text-color-secondary);
  }
</style>
