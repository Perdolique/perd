# Passkeys

Users with a verified email or linked Twitch account can add passkeys in Account. The current valid session is enough to add, rename, or remove a key. Removal requires confirmation. Guests must add email or Twitch first. These methods remain the recovery path; passkey-only account creation and account merging are not supported.

## Configuration

Set the private runtime setting `passkeys.origin` with `NUXT_PASSKEYS_ORIGIN`:

| Environment | Origin | RP ID |
| --- | --- | --- |
| Production | `https://metsik.app` | `metsik.app` |
| Staging | `https://staging.metsik.app` | `staging.metsik.app` |
| Local Nuxt | `http://localhost:3000` | `localhost` |
| Local Worker preview | `http://localhost:8888` | `localhost` |
| Browser and Worker tests | `http://localhost:8888` | `localhost` |

Set `NUXT_PASSKEYS_ORIGIN` in `.env` to `http://localhost:3000` for `vp run dev`. Change it to `http://localhost:8888` before `vp run preview` or `vp run preview:local`. Wrangler loads `.env` over the default in `wrangler.jsonc`.

The server derives the RP ID from this setting. Request headers cannot change it. Mutations require the exact Origin and JSON content type, except DELETE, which has no body. Verification bodies are limited to 64 KiB. All passkey API responses use `Cache-Control: no-store`.

`PASSKEY_RATE_LIMITER` allows 10 requests per 60 seconds. Options and verification have separate keys. Authentication uses the trusted Cloudflare client IP; registration uses the account ID. Production, staging, and local bindings use separate namespaces. A missing binding returns 503; a denied request returns 429.

## Persistence and sessions

The additive `20260922161614_passkeys` migration creates credentials and challenges, and adds an optional random 32-byte user handle. The handle stays stable after the last key is removed. Account deletion removes credentials and registration challenges through foreign keys.

Credentials use a globally unique WebAuthn ID, a base64url public key, a bigint counter, backup flags, transports, and display metadata. Management APIs only expose the internal UUID, name, and dates. Names are trimmed and limited to 1–64 characters.

Challenges expire after five minutes. Each session has one current challenge per operation. An older request cannot replace a challenge issued by a newer request. If request timestamps are equal, the first stored challenge stays current. Issuance removes up to 100 expired records. Verification consumes the challenge with a committed `DELETE RETURNING` before checking the response; failed verification requires new options.

Authentication locks the account before the credential and verifies the current counter inside the transaction. It accepts authenticators whose counter stays zero. The application session is updated only after the transaction commits. Registration rechecks the account, recovery method, and session version before saving. A signed-in user receives 409 when starting passkey sign-in.

SimpleWebAuthn verifies ES256, RS256, and Ed25519 signatures, origin, RP ID, challenge, and user presence and verification. The application also checks user-handle ownership and immutable backup eligibility. Technical errors retain diagnostics while credential payloads, handles, challenges, key material, and SQL parameters are removed from logs.

## Verification

Start the local PostgreSQL and Neon proxy from `docker-compose.yml`. The integration helpers require `NUXT_LOCAL_DATABASE=true` and a local `NUXT_DATABASE_URL`. They create and remove a separate schema. Worker tests also create a temporary database role because the local HTTP proxy does not preserve URL `search_path` options. The local database account needs permission to create roles. Existing application data is not changed.

Run focused unit tests:

```sh
vp run test:unit:agent server/utils/auth/__tests__/passkey-request.test.ts server/utils/auth/__tests__/passkey-verification.test.ts
```

Build the same Worker artifact used for deployment, then run integration tests. Export the two local database variables from your local environment before running Vitest. Do not use a staging or production URL.

```sh
vp run build:e2e
WRANGLER_LOG_PATH=.output/e2e/logs vpx vitest run --config tests/integration/vitest.config.ts tests/integration/passkeys.test.ts tests/integration/passkeys-worker.test.ts
vp run test:e2e tests/playwright/login/passkeys.test.ts
```

The Worker suite uses Wrangler `createTestHarness`, real signatures, real session cookies, and isolated PostgreSQL. A test-only Miniflare transport adapter handles WebSocket upgrades missing from Wrangler 4.131.1's harness. It does not add authorization bypasses to the application. Browser tests use virtual authenticators and verify their signatures in API fixtures. They cover key management, repeated registration, sign-in, cancellation, and narrow layouts.

The shared WebSocket client uses the native WebSocket available in the project's Node version and Workers runtime. The `ws` browser entry is not usable in a Worker. Nitro must preserve `reflect-metadata` initialization; see [Technical debt](TECHNICAL_DEBT.md).

## Release order

1. Apply the migration before deploying the Worker.
2. Deploy the Worker and its environment-specific origin and rate limiter to staging.
3. Verify enrollment and sign-in with a real device and an external security key. Check email sign-in, password recovery, and Twitch linking.
4. Publish through the normal release process after staging checks pass.

Automated virtual-authenticator checks do not replace the real-device staging check. Production and staging keys are scoped to different RP IDs.
