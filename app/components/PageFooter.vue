<template>
  <footer :class="$style.footer">
    <a
      href="https://github.com/Perdolique/perd"
      target="_blank"
      rel="noopener"
      :class="$style.link"
    >
      <Icon name="tabler:brand-github" />
    </a>

    <a
      href="https://t.me/perdTV"
      target="_blank"
      rel="noopener"
      :class="$style.link"
    >
      <Icon name="tabler:brand-telegram" />
    </a>

    <a
      href="https://www.twitch.tv/perdolique"
      target="_blank"
      rel="noopener"
      :class="$style.link"
    >
      <Icon name="tabler:brand-twitch" />
    </a>
  </footer>
</template>

<style lang="scss" module>
  .footer {
    display: flex;
    gap: var(--spacing-16);
    justify-content: center;
    padding: var(--spacing-8);
    text-align: center;
    border-top: 1px solid var(--background-200);
  }

  .link {
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    height: 40px;
    width: 40px;
    color: var(--text-color-secondary);
    transition:
      color var(--transition-time-quick),
      background-color var(--transition-time-quick);
    font-size: var(--font-size-20);
    border-radius: var(--border-radius-8);

    &:focus-visible,
    &:hover {
      color: var(--text);
      background-color: var(--background-100);
    }
  }
</style>
