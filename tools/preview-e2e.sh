#!/usr/bin/env sh
set -eu

e2e_root="$(mktemp -d "${TMPDIR:-/tmp}/perd-e2e.XXXXXX")"
twitch_client_id="e2e-client"
twitch_client_secret="e2e-secret"

cleanup() {
  rm -rf "${e2e_root}"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export XDG_CONFIG_HOME="${e2e_root}/config"
export XDG_CACHE_HOME="${e2e_root}/cache"
export XDG_STATE_HOME="${e2e_root}/state"
export WRANGLER_LOG_PATH="${e2e_root}/logs"
export WRANGLER_CACHE_DIR="${e2e_root}/cache/wrangler"
export CLOUDFLARE_HOME="${e2e_root}/home"

mkdir -p \
  "${XDG_CONFIG_HOME}" \
  "${XDG_CACHE_HOME}" \
  "${XDG_STATE_HOME}" \
  "${WRANGLER_LOG_PATH}" \
  "${CLOUDFLARE_HOME}"

NUXT_OAUTH_TWITCH_CLIENT_ID="${twitch_client_id}" \
NUXT_OAUTH_TWITCH_CLIENT_SECRET="${twitch_client_secret}" \
PERD_E2E_PAGES="true" \
  vp run build

vp exec wrangler dev \
  --var "NUXT_OAUTH_TWITCH_CLIENT_ID:${twitch_client_id}" \
  --var "NUXT_OAUTH_TWITCH_CLIENT_SECRET:${twitch_client_secret}"
