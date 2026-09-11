<template>
  <div :class="$style.component">
    <picture :class="$style.backgroundMedia" aria-hidden="true">
      <source
        srcset="/images/login-background-desktop.avif"
        media="(width >= 860px)"
        type="image/avif"
      >

      <source
        srcset="/images/login-background-mobile.avif"
        type="image/avif"
      >

      <img
        :class="$style.backgroundImage"
        src="/images/login-background-mobile.avif"
        width="941"
        height="1672"
        alt=""
        decoding="async"
        fetchpriority="high"
        loading="eager"
      >
    </picture>

    <main :class="$style.content">
      <slot />
    </main>

    <footer :class="$style.footer">
      <a
        :class="$style.footerLink"
        href="https://github.com/Perdolique/perd"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>

      <span v-if="buildCommitSha" :class="$style.commit">
        Commit
        <a
          :class="$style.footerLink"
          :href="buildCommitUrl"
          target="_blank"
          rel="noreferrer"
        >
          #{{ buildCommitShortSha }}
        </a>
      </span>
    </footer>
  </div>
</template>

<script lang="ts" setup>
  import { useHead, useRuntimeConfig } from '#imports'

  useHead({
    link: [{
      rel: 'preload',
      as: 'image',
      href: '/images/login-background-mobile.avif',
      type: 'image/avif',
      media: '(width < 860px)',
      fetchpriority: 'high'
    }, {
      rel: 'preload',
      as: 'image',
      href: '/images/login-background-desktop.avif',
      type: 'image/avif',
      media: '(width >= 860px)',
      fetchpriority: 'high'
    }]
  })

  const { buildCommitSha } = useRuntimeConfig().public
  const buildCommitShortSha = buildCommitSha.slice(0, 7)
  const buildCommitUrl = `https://github.com/Perdolique/perd/commit/${buildCommitSha}`
</script>

<style module>
  .component {
    position: relative;
    isolation: isolate;
    min-block-size: 100dvh;
    display: grid;
    grid-template-rows: minmax(min-content, 1fr) auto;
    align-items: center;
    overflow-x: clip;
    padding:
      max(var(--spacing-24), env(safe-area-inset-top))
      var(--spacing-16)
      max(var(--spacing-24), env(safe-area-inset-bottom));
    background: var(--color-background-muted);

    &::after {
      content: "";
      position: absolute;
      z-index: 1;
      inset: 0;
      background:
        linear-gradient(
          180deg,
          color-mix(in oklch, var(--color-overlay-background), transparent 78%),
          color-mix(in oklch, var(--color-overlay-background), transparent 6%)
        );
      pointer-events: none;
    }

    @media (width >= 860px) {
      padding-inline: var(--spacing-32);
    }
  }

  .backgroundMedia {
    position: absolute;
    z-index: 0;
    inset: 0;
  }

  .backgroundImage {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    object-position: center bottom;
  }

  .content,
  .footer {
    position: relative;
    z-index: 2;
    inline-size: min(100%, 28rem);
    min-inline-size: 0;
    margin-inline: auto;
  }

  .content {
    padding-block: var(--spacing-16);
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-8) var(--spacing-16);
    padding-block: var(--spacing-8);
    color: color-mix(in oklch, var(--color-white) 82%, transparent);
    font-size: var(--font-size-14);
    text-align: center;
  }

  .commit {
    display: inline-flex;
    align-items: baseline;
    gap: var(--spacing-4);
  }

  .footerLink {
    color: var(--color-white);
    font-weight: var(--font-weight-semibold);
    text-decoration: none;
    text-underline-offset: var(--spacing-4);

    &:hover,
    &:focus-visible {
      text-decoration: underline;
    }

    &:active {
      color: var(--color-sand-100);
    }
  }
</style>
