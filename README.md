# Perd

<https://metsik.app/>

Perd is an outdoor equipment companion for people who plan trips, hikes, and other outdoor outings and do not want to forget important gear.

## What you can do now

- sign in;
- open the gear library;
- browse the current list of equipment reference items;
- open item detail pages;
- save items to my gear;
- create packing lists;
- add custom and my gear checklist entries;
- mark checklist entries as packed.

The priority is the user workflow, not internal admin tooling.

## Similar applications

- [lighterpack.com](https://lighterpack.com)
- [hikepack.app](https://www.hikepack.app/list/84a8ea0c-006b-4cff-bb2b-7bcf52183b0b)
- [packstack.io](https://www.packstack.io/)
- [Don't Forget the Spoon](https://play.google.com/store/apps/details?id=com.dontforgetthespoon.dont_forget_the_spoon&hl=en_US&pli=1)
- ~~packflare.com~~
- ~~geargrams.com~~
- ~~trailhawk.io~~
- ~~baseweight.co~~
- ~~packlist.io~~
- ~~outdoormojo.com~~

## Stack

- [Nuxt](https://nuxt.com/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Neon](https://neon.tech/)
- [Drizzle ORM](https://orm.drizzle.team/)

## Local sign-in

For a local Worker with all Cloudflare bindings, copy `.env.example` to `.env`
and set the local database URL and session secret. Set both
`NUXT_EMAIL_REGISTRATION_ORIGIN` and `NUXT_PASSKEYS_ORIGIN` to
`http://localhost:8888`. Then run `vp run db:migrate:local`, `vp run build`,
and `vp run preview:local`. The local preview uses the test Turnstile keys from
`.env.example`, local rate limits, and simulated email delivery. Verification
emails are saved under `.wrangler/tmp/email`.

Twitch sign-in also needs a Twitch application. Set its client ID and secret
in `.env`, then register `http://localhost:8888/auth/twitch` as an OAuth
redirect URL in Twitch. Without those credentials, the other local sign-in
methods still work.

## Database changes

Migrations are the only automatic way to change existing environments. Run the
destructive catalog reset only for a local or new empty database with
`vp run db:reset:catalog:local` or `vp run db:reset:catalog`.

Every canonical catalog or reference-data change must include a targeted,
one-time SQL migration and the matching update to the seed definitions.

## Email registration

See [Email registration](EMAIL_REGISTRATION.md) for rollout prerequisites, local
development, and focused verification. Production enablement is gated on #748.
