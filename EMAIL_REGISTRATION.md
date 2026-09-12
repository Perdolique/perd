# Email registration

Registration is implemented in #747, email/password sign-in in #748, and password
recovery in #749. Twitch linking has a separate follow-up issue.

## Deployment prerequisites

Apply the additive `20260907211007_serious_vector` migration before deploying this
application version, even while registration is disabled: `GET /api/user` reads
verified credentials to determine whether an account is a guest. The migration
adds `email_credentials` and `pending_email_registrations`; it does not alter or
backfill existing accounts.

Apply the additive `20260912070747_spooky_puma` migration before deploying the
password recovery Worker. It adds `password_reset_tokens` with a cascading foreign
key to verified email credentials and adds a zero-valued session version to existing
users. The build workflow gates deployment on successful migration.

The Worker requires `nodejs_compat` at compatibility date `2026-07-18` and these
bindings in every environment:

- `EMAIL`: Email Sending, restricted to sender `noreply@metsik.app`.
- `EMAIL_REGISTRATION_RATE_LIMITER`: 3 requests per 60 seconds, checked separately
  for the client IP and normalized email hash.
- `EMAIL_VERIFICATION_RATE_LIMITER`: 5 requests per 60 seconds, checked separately
  for the client IP and token hash.
- `EMAIL_SIGN_IN_RATE_LIMITER`: 5 requests per 60 seconds, checked separately for
  the client IP and normalized email SHA-256 hash.
- `PASSWORD_RECOVERY_RATE_LIMITER`: 3 requests per 60 seconds. Recovery requests
  use `request-ip:` and `request-email:` keys. Reset requests use separate
  `reset-ip:` and `reset-email:` keys, checking the IP before token lookup and the
  email hash after a valid token is found.

Each environment has separate rate limiter namespaces. Email sign-in uses
`687734013` in development, `687734014` in staging, and `687734015` in
production. Password recovery uses `687734016` in development, `687734017` in
staging, and `687734018` in production. A limited request returns `429` with
`Retry-After: 60`. Cloudflare rate limits are eventually consistent and enforced
per location; these permissive bindings reduce brute-force and spam attempts
rather than providing a strict global quota.

`NUXT_PUBLIC_EMAIL_REGISTRATION_ENABLED` controls registration only. Only `true`
enables registration pages and APIs; when disabled, they return `404` before
database or mail work. Email sign-in and password recovery remain available
independently of this flag. Production registration is enabled in the checked-in
configuration; staging registration and recovery delivery are restricted to one
controlled recipient.

Set the following runtime values before enabling an environment:

| Variable | Value |
| --- | --- |
| `NUXT_EMAIL_REGISTRATION_ENVIRONMENT` | `development`, `staging`, or `production` |
| `NUXT_EMAIL_REGISTRATION_ORIGIN` | Exact public origin, without a trailing slash or path |
| `NUXT_EMAIL_REGISTRATION_STAGING_RECIPIENT` | One controlled recipient, required in staging |

Production and staging require HTTPS. The configured origin must match the
browser's `Origin` header; verification links use this origin, never request
headers. Turnstile must allow that hostname and validate the server-selected
`email_registration`, `email_sign_in`, `password_recovery_request`, or
`password_recovery_reset` action. Guest access uses `guest_session`. Turnstile
tokens are verified only by the server, are single-use, and must be replaced before
every retry.

Before launching staging:

1. Onboard the `metsik.app` Email Sending domain and use `noreply@metsik.app` as
   the allowed sender in Cloudflare.
2. Set the single controlled staging address in both the
   `NUXT_EMAIL_REGISTRATION_STAGING_RECIPIENT` Worker secret and the staging
   `EMAIL.allowed_destination_addresses` array in `wrangler.jsonc`. On Workers
   Paid, this recipient does not need to remain in the account-level Destination
   Addresses list. Registration rejects other recipients. Recovery keeps its
   neutral accepted response but skips token creation and delivery. Neither flow
   substitutes the test mailbox.
3. Confirm the build workflow applies the migration before deployment, regenerate
   Worker types with `vp run cf-typegen`, and verify the binding and exact staging
   origin.
4. Check registration and recovery delivery, expiry, retries, and confirmation
   after deployment.

The sender domain and staging recipient are configured, but mailbox delivery must
still be smoke-tested after deployment. Arbitrary recipients require Workers
Paid. Email Sending includes 3,000 messages per month per account, then $0.35 per
1,000; existing-account notices and resends also count. See the
[Cloudflare pricing documentation](https://developers.cloudflare.com/email-service/platform/pricing/).

Before deploying the production activation, confirm all of the following:

1. The Email Sending domain and `noreply@metsik.app` sender are verified.
2. The production Worker has the existing `EMAIL` binding restricted to that
   sender.
3. The `20260907211007_serious_vector` migration from #747 has been applied.
4. The `20260912070747_spooky_puma` migration from #749 has been applied.

## Local development

Use `.env.example` with the local PostgreSQL and Neon proxy services. Set
`NUXT_LOCAL_DATABASE=1`, migrate with `vp run db:migrate:local`, and use `vp run dev`.
The example origin is `http://localhost:3000`; use the actual browser origin when
running on another port. For a locally built Worker, use `vp run build` and
`vp run preview` with the corresponding origin in the local environment file.

Keep mail bindings local: Wrangler/Miniflare simulates Email Sending instead of
contacting real recipients. Its local mailbox artifacts contain verification
links and must not be published. Do not enable remote bindings for these tests.
HIBP password screening still requires network access. It sends only the first
five SHA-1 characters with `Add-Padding: true`; unavailable or malformed responses
fail closed with `503` and may be retried.

## Account and token behavior

The request API returns `202 { accepted: true }` for new, already registered, and
pending addresses after successful processing. Existing addresses receive an
account notice. Every other accepted request gets its own one-hour token and
password hash, so resending with another password does not change older links.
Passwords preserve spaces and Unicode and must contain 15–128 Unicode code points.

New registrations create an account only after the token and chosen password are
confirmed. They can be confirmed in another signed-out browser. Adding email to a
guest or Twitch user requires the same user and original session, and keeps the
existing session, user ID, permissions, gear, packing lists, and contributions.

The confirmation page removes the fragment from both the visible URL and Vue
Router history state. Its token is kept only in page memory. Reloading requires
opening the original email link again. Opening a link never activates an account.

Email issuance and confirmation use WebSocket transactions and per-email advisory
locks. Upgrades also lock the user row. Mail rejection rolls back the pending row;
a commit failure after provider acceptance can leave an unusable link, requiring a
retry. Confirmation consumes all sibling tokens for that email atomically. Session
creation for a new account happens after the transaction commits.

SQL parameter logging is disabled. Authentication diagnostics retain provider
causes with supplied secrets redacted, and Drizzle query text/parameters are
excluded. Passwords and raw verification tokens are never returned by these APIs.

## Password recovery behavior

`POST /api/auth/email/password-recovery` returns the same
`202 { accepted: true }` after request validation, Turnstile, and rate limiting for
known, unknown, and staging-ineligible addresses. It schedules database and email
work with `event.waitUntil()`, so the public response does not reveal credential
lookup or provider delivery results. Background failures are caught and logged
with the email, plaintext token, and token hash redacted.

For a known eligible address, the Worker generates 32 random bytes and emails a
one-hour link whose 43-character base64url token appears only in the URL fragment.
Only its SHA-256 hash is stored. A sanitized sign-in redirect is stored beside the
hash and appears only as a regular query parameter. Token issuance commits in a
WebSocket transaction under the per-email advisory lock before `EMAIL.send()` runs.
An explicit provider rejection triggers a compensating token deletion under the
same lock. PostgreSQL and Email Sending do not form a distributed transaction, so
delivery diagnostics remain important. Unknown and staging-ineligible addresses
create no token and send no email. Issuance purges expired tokens through the
`expiresAt` index, and presenting an expired token deletes that row.

The reset page reads the token only in the browser, immediately removes the
fragment from the visible URL and Vue Router history, keeps it only in memory, and
sets `Referrer-Policy: no-referrer`. The reset API rejects invalid, expired,
replayed, and concurrency-losing tokens with the same safe response. It checks
HIBP and computes the new scrypt hash before reacquiring the same email lock. One
commit updates the verified credential and deletes every sibling reset token. A
failed update or delete preserves the old password and tokens.

Successful reset does not create or replace a session. The user signs in normally
with the new password. The same transaction increments the user's session version,
so existing session cookies are rejected on their next protected API request. No
separate password-changed message is sent.

For a staging smoke test, request recovery for the configured staging recipient,
open the received fragment link, set a new password, and sign in through `/login`.
Confirm that the old password fails, the new password succeeds, replay shows the
invalid-link state, and a non-allowlisted address still receives the neutral
accepted response without delivery.

## Focused verification

Run formatting before the applicable checks. Unit tests and type/lint checks can
run in parallel; full suites are left to commit hooks.

```sh
vp run format
vp run test:typecheck
vp run test:unit:agent server/utils/auth/__tests__ server/api/auth/email/__tests__ server/database/__tests__/migration.test.ts server/utils/__tests__/user.test.ts server/utils/__tests__/turnstile.test.ts server/utils/__tests__/cloudflare-config.test.ts server/api/auth/__tests__/create-session.test.ts server/middleware/__tests__/database.test.ts server/middleware/__tests__/api-session-check.test.ts shared/utils/__tests__/redirect.test.ts
vp exec node --env-file=.env node_modules/vitest/vitest.mjs run tests/integration/email-registration.test.ts tests/integration/email-password-recovery.test.ts --config tests/integration/vitest.config.ts
vp run test:e2e tests/playwright/registration/email-registration.test.ts tests/playwright/registration/email-registration-disabled.test.ts tests/playwright/login/login.test.ts tests/playwright/login/email-sign-in.test.ts tests/playwright/login/email-password-recovery.test.ts
vp run lint:markdown
vp run build
vp exec wrangler deploy --dry-run --env=staging
vp exec wrangler deploy --dry-run --env=production
```

The PostgreSQL test refuses a remote host or a disabled local database flag. It
creates a random temporary schema, verifies its search path, applies the actual
migration chain, and drops only that schema after testing. It covers concurrent
confirmations, sibling tokens, competing upgrades, delivery and insertion rollback,
invalid credentials, session conflicts, and preservation of existing account data.

Playwright exercises the built Worker with mocked API responses for interaction
scenarios. The disabled-feature tests start another local Worker with no database
or registration origin configured and assert real `404` responses. The real
PostgreSQL tests and API unit tests own database/security behavior.
