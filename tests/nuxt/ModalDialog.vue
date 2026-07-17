<template>
  <main :class="$style.component">
    <h1 :class="$style.heading">
      Modal dialog browser fixtures
    </h1>

    <div :class="$style.actions">
      <PerdButton @click="openCenteredDialog">
        Open centered dialog
      </PerdButton>

      <PerdButton @click="openBottomSheet">
        Open bottom sheet
      </PerdButton>

      <PerdButton @click="openSideSheet">
        Open side sheet
      </PerdButton>

      <PerdButton @click="openLongBottomSheet">
        Open long bottom sheet
      </PerdButton>

      <PerdButton @click="openLockedBottomSheet">
        Open locked bottom sheet
      </PerdButton>
    </div>

    <ModalDialog
      v-model="centeredOpened"
      aria-labelledby="centered-dialog-title"
    >
      <section :class="$style.centeredSurface">
        <h2 id="centered-dialog-title">
          Centered dialog
        </h2>

        <PerdButton @click="closeCenteredDialog">
          Close centered dialog
        </PerdButton>
      </section>
    </ModalDialog>

    <ModalDialog
      v-model="sideSheetOpened"
      aria-labelledby="side-sheet-title"
      desktop-presentation="side-sheet"
    >
      <section :class="$style.sideSheetSurface">
        <h2 id="side-sheet-title" tabindex="-1" autofocus>
          Side sheet
        </h2>

        <label for="side-sheet-filter">
          Side filter name
        </label>

        <input id="side-sheet-filter" :class="$style.input" name="side-filter">

        <PerdButton @click="closeSideSheet">
          Close side sheet
        </PerdButton>
      </section>
    </ModalDialog>

    <ModalDialog
      v-model="bottomSheetOpened"
      aria-labelledby="bottom-sheet-title"
      mobile-presentation="bottom-sheet"
    >
      <section :class="$style.sheetSurface">
        <h2 id="bottom-sheet-title">
          Bottom sheet
        </h2>

        <label for="bottom-sheet-filter">
          Filter name
        </label>

        <input id="bottom-sheet-filter" :class="$style.input" name="filter">

        <PerdButton @click="closeBottomSheet">
          Close bottom sheet
        </PerdButton>
      </section>
    </ModalDialog>

    <ModalDialog
      v-model="longBottomSheetOpened"
      aria-labelledby="long-bottom-sheet-title"
      mobile-presentation="bottom-sheet"
    >
      <section :class="[$style.sheetSurface, 'isLong']">
        <h2 id="long-bottom-sheet-title">
          Long bottom sheet
        </h2>

        <label for="long-bottom-sheet-filter">
          Filter name
        </label>

        <input id="long-bottom-sheet-filter" :class="$style.input" name="filter">

        <div :class="$style.spacer" aria-hidden="true" />

        <PerdButton @click="closeLongBottomSheet">
          Close long bottom sheet
        </PerdButton>
      </section>
    </ModalDialog>

    <ModalDialog
      v-model="lockedBottomSheetOpened"
      aria-labelledby="locked-bottom-sheet-title"
      close-disabled
      mobile-presentation="bottom-sheet"
    >
      <section :class="$style.sheetSurface">
        <h2 id="locked-bottom-sheet-title">
          Locked bottom sheet
        </h2>

        <p>
          Escape and backdrop dismiss are disabled.
        </p>

        <PerdButton @click="completeLockedBottomSheet">
          Complete locked bottom sheet
        </PerdButton>
      </section>
    </ModalDialog>
  </main>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'
  import { definePageMeta } from '#imports'
  import PerdButton from '~/components/PerdButton.vue'
  import ModalDialog from '~/components/dialogs/ModalDialog.vue'

  definePageMeta({
    layout: false,
    skipAuth: true
  })

  const centeredOpened = ref(false)
  const bottomSheetOpened = ref(false)
  const sideSheetOpened = ref(false)
  const longBottomSheetOpened = ref(false)
  const lockedBottomSheetOpened = ref(false)

  function openCenteredDialog() {
    centeredOpened.value = true
  }

  function closeCenteredDialog() {
    centeredOpened.value = false
  }

  function openBottomSheet() {
    bottomSheetOpened.value = true
  }

  function closeBottomSheet() {
    bottomSheetOpened.value = false
  }

  function openSideSheet() {
    sideSheetOpened.value = true
  }

  function closeSideSheet() {
    sideSheetOpened.value = false
  }

  function openLongBottomSheet() {
    longBottomSheetOpened.value = true
  }

  function closeLongBottomSheet() {
    longBottomSheetOpened.value = false
  }

  function openLockedBottomSheet() {
    lockedBottomSheetOpened.value = true
  }

  function completeLockedBottomSheet() {
    lockedBottomSheetOpened.value = false
  }
</script>

<style module>
  .component {
    display: grid;
    align-content: start;
    gap: var(--spacing-24);
    min-block-size: 100dvh;
    padding: var(--spacing-24);
    background-color: var(--color-background-page);
  }

  .heading {
    font-size: var(--font-size-30);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-16);
  }

  .centeredSurface,
  .sheetSurface,
  .sideSheetSurface {
    display: grid;
    gap: var(--spacing-16);
    inline-size: min(100vw - var(--spacing-32), 30rem);
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-24);
    background-color: var(--color-surface-primary);
    box-shadow: var(--shadow-large);
  }

  .sheetSurface {
    &:global(.isLong) {
      min-block-size: 42rem;
    }

    @media (width < 900px) {
      inline-size: 100%;
      border: none;
      border-radius: inherit;
      box-shadow: none;
    }
  }

  .sideSheetSurface {
    min-block-size: 100%;
    inline-size: 100%;
    border: none;
    border-radius: inherit;
    box-shadow: none;
  }

  .input {
    min-block-size: var(--layout-button-height-medium);
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--layout-button-radius-small);
    background-color: var(--color-background-elevated);
    color: var(--color-text-primary);
  }

  .spacer {
    min-block-size: 24rem;
  }
</style>
