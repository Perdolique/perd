<template>
  <nav :class="$style.navigationGroup" aria-label="Workspace navigation">
    <NuxtLink
      :to="appRoutes.home"
      exact-active-class="active"
      :class="$style.navigationItem"
    >
      <Icon
        :name="navigationIcons.home"
        :class="$style.navigationIcon"
        aria-hidden="true"
      />
      <span>{{ navigationLabels.home }}</span>
    </NuxtLink>

    <NuxtLink
      :to="appRoutes.gearLibrary"
      active-class="active"
      :class="$style.navigationItem"
    >
      <Icon
        :name="navigationIcons.gearLibrary"
        :class="$style.navigationIcon"
        aria-hidden="true"
      />
      <span>{{ navigationLabels.gearLibrary }}</span>
    </NuxtLink>

    <NuxtLink
      :to="appRoutes.myGear"
      active-class="active"
      :class="$style.navigationItem"
    >
      <Icon
        :name="navigationIcons.myGear"
        :class="$style.navigationIcon"
        aria-hidden="true"
      />
      <span>{{ navigationLabels.myGear }}</span>
    </NuxtLink>

    <NuxtLink
      :to="appRoutes.packingLists"
      active-class="active"
      :class="$style.navigationItem"
    >
      <Icon
        :name="navigationIcons.packingLists"
        :class="$style.navigationIcon"
        aria-hidden="true"
      />
      <span>{{ navigationLabels.packingLists }}</span>
    </NuxtLink>

    <NuxtLink
      v-if="isAdmin"
      :to="appRoutes.admin"
      active-class="active"
      :class="$style.navigationItem"
    >
      <Icon
        :name="navigationIcons.admin"
        :class="$style.navigationIcon"
        aria-hidden="true"
      />
      <span>{{ navigationLabels.admin }}</span>
    </NuxtLink>
  </nav>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { useUserStore } from '#imports'
  import { appRoutes, navigationIcons, navigationLabels } from '~/utils/navigation'

  const { user } = useUserStore()
  const isAdmin = computed(() => user.value.isAdmin)
</script>

<style module>
  .navigationGroup {
    display: grid;
    gap: var(--spacing-8);
  }

  .navigationItem {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    min-height: var(--layout-touch-target);
    padding: 0 var(--spacing-12);
    border-radius: var(--border-radius-14);
    color: var(--color-text-secondary);
    background: transparent;
    text-decoration: none;
    border: 1px solid transparent;
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      border-color var(--transition-duration-normal) var(--transition-easing-standard),
      color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover,
    &:focus-visible {
      background: var(--color-surface-primary);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }

    &:global(.active) {
      background: var(--color-surface-primary);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
      box-shadow: inset 3px 0 0 var(--color-accent-primary);
    }
  }

  .navigationIcon {
    font-size: 1rem;
    flex-shrink: 0;
  }
</style>
