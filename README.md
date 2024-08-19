# Equipment list

https://perd.pages.dev/

A web app for those who love hanging out in the forest but always forget to bring something important. With this app, you can easily create a checklist of things you must take on your adventure.

# Planning features

- [x] List of equipment you have
- [ ] Lists of equipment you want to bring on your adventure (adventure lists)
- [ ] Ability to share adventure lists with friends (or strangers)
- [ ] Crosschecks
- [ ] Equipment comparator
- [ ] ... 🤔

# Similar applications

* [lighterpack.com](https://lighterpack.com) (ugly)
* [packflare.com](https://packflare.com/packs/zdihojtsew) (sign-up doesn't work)
* [hikepack.app](https://www.hikepack.app/list/84a8ea0c-006b-4cff-bb2b-7bcf52183b0b) (simple TODO list)
* [packstack.io](https://www.packstack.io/) (Bad UX)
* [Don't Forget the Spoon](https://play.google.com/store/apps/details?id=com.dontforgetthespoon.dont_forget_the_spoon&hl=en_US&pli=1) (Adnroid, featureless)
* ~~geargrams.com~~ (dead)
* ~~trailhawk.io~~ (dead)
* ~~baseweight.co~~ (dead)
* ~~packlist.io~~ (dead)
* ~~outdoormojo.com~~ (dead)
* ... (suggestions are welcome)

# Stack

## Current (playground)

* [Nuxt](https://nuxt.com/)
* [Cloudflare Pages](https://developers.cloudflare.com/pages/)
* [Cloudflare Workers](https://developers.cloudflare.com/workers/)
* [Neon database](https://neon.tech)

### Details

* Authentication
  * [H3 built-in sessions](https://h3.unjs.io/examples/handle-session)
  * User/Admin separation
  * Anonymous users
* UI
  * "Evergreen"/[Baseline](https://web.dev/baseline) browsers only
  * Native [CSS Nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting)
  * Custom UI components
* Misc
  * [Drizzle ORM](https://orm.drizzle.team/)
  * [Valibot](https://github.com/fabian-hiller/valibot) (type-safe schema validation)

## MVP Release

* [Nuxt](https://nuxt.com/)
* [Cloudflare Pages](https://developers.cloudflare.com/pages/)
* [Cloudflare Workers](https://developers.cloudflare.com/workers/)
