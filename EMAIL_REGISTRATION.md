# Email registration

Registration is implemented in #747. Production stays disabled until email login
ships in #748. Password reset and Twitch linking have separate follow-up issues.

## Deployment prerequisites

Apply the additive `20260907211007_serious_vector` migration before deploying this
application version, even while registration is disabled: `GET /api/user` reads
verified credentials to determine whether an account is a guest. The migration
adds `email_credentials` and `pending_email_registrations`; it does not alter or
backfill existing accounts.

The Worker requires `nodejs_compat` at compatibility date `2026-07-18` and these
bindings in every environment:

- `EMAIL`: Email Sending, restricted to sender `noreply@metsik.app`.
- `EMAIL_REGISTRATION_RATE_LIMITER`: 3 requests per 60 seconds, checked separately
  for the client IP and normalized email hash.
- `EMAIL_VERIFICATION_RATE_LIMITER`: 5 requests per 60 seconds, checked separately
  for the client IP and token hash.

Each environment has separate rate limiter namespaces. A limited request returns
`429` with `Retry-After: 60`. Cloudflare rate limits are enforced per location;
these bindings are not a globally synchronized quota.

`NUXT_PUBLIC_EMAIL_REGISTRATION_ENABLED` is the single UI/server switch. Only
`true` enables it. When disabled, both new pages and APIs return `404` before
registration database or mail work. Staging and production are disabled in the
checked-in configuration.

Set the following runtime values before enabling an environment:

| Variable | Value |
| --- | --- |
| `NUXT_EMAIL_REGISTRATION_ENVIRONMENT` | `development`, `staging`, or `production` |
| `NUXT_EMAIL_REGISTRATION_ORIGIN` | Exact public origin, without a trailing slash or path |
| `NUXT_EMAIL_REGISTRATION_STAGING_RECIPIENT` | One verified recipient, required in staging |

Production and staging require HTTPS. The configured origin must match the
browser's `Origin` header; verification links use this origin, never request
headers. Turnstile must allow that hostname and validate the server-selected
`email_registration` action. Guest access uses `guest_session`.

Before launching staging:

1. Verify the Email Sending domain and `noreply@metsik.app` sender in Cloudflare.
2. Choose and verify the single staging recipient.
3. Set that same address in `NUXT_EMAIL_REGISTRATION_STAGING_RECIPIENT` and the
   staging `EMAIL.allowed_destination_addresses` array in `wrangler.jsonc`.
   An empty Cloudflare destination list is unrestricted, so the checked-in
   binding is not launch-ready. Until a recipient is configured, the server
   rejects other recipients; it never substitutes the test mailbox.
4. Apply the migration, regenerate Worker types with `vp run cf-typegen`, and
   verify the binding and exact staging origin.
5. Enable the staging flag and check delivery, expiry, retries, and confirmation.

The sender domain, staging recipient, and remaining monthly email allowance have
not been confirmed by this change. Arbitrary recipients require Workers Paid.
Email Sending includes 3,000 messages per month per account, then $0.35 per 1,000;
existing-account notices and resends also count. See the
[Cloudflare pricing documentation](https://developers.cloudflare.com/email-service/platform/pricing/).

Production enablement belongs to #748 so a newly secured account can subsequently
sign in with email. Do not enable production as part of #747.

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

## Focused verification

Run formatting before the applicable checks. Unit tests and type/lint checks can
run in parallel; full suites are left to commit hooks.

```sh
vp run format
vp run test:typecheck
vp run test:unit:agent server/utils/auth/__tests__ server/api/auth/email/__tests__ server/utils/__tests__/user.test.ts server/utils/__tests__/turnstile.test.ts server/api/auth/__tests__/create-session.test.ts server/middleware/__tests__/database.test.ts shared/utils/__tests__/redirect.test.ts
vp exec node --env-file=.env node_modules/vitest/vitest.mjs run tests/integration/email-registration.test.ts --config tests/integration/vitest.config.ts
vp run test:e2e tests/playwright/registration/email-registration.test.ts tests/playwright/registration/email-registration-disabled.test.ts tests/playwright/login/login.test.ts
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
