# Equipment list

https://perd.pages.dev/

A web app for those who love hanging out in the forest but always forget to bring something important. With this app, you can easily create a checklist of things you must take on your adventure.

# Planning features

- [ ] List of equipment you have
- [ ] Lists of equipment you want to bring on your adventure (adventure lists)
- [ ] Ability to share adventure lists with friends (or strangers)
- [ ] Crosschecks
- [ ] Equipment comparator
- [ ] ... 🤔

# Similar applications

* https://lighterpack.com
* ... (suggestions are welcome)

# Stack

## Current (playground)

* [Nuxt](https://nuxt.com/)
* [Cloudflare Pages](https://developers.cloudflare.com/pages/)
* [Cloudflare Workers](https://developers.cloudflare.com/workers/)
* [Cloudflare D1](https://developers.cloudflare.com/d1/)

### Details

* Authentication
  * [H3 built-in sessions](https://h3.unjs.io/examples/handle-session)
  * User/Admin separation
  * Anonymous users
* UI
  * Evergreen browsers only
  * Native [CSS Nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting)
  * Custom UI components
* Misc
  * [Drizzle ORM](https://orm.drizzle.team/)

## MVP Release

* [Nuxt](https://nuxt.com/)
* [Cloudflare Pages](https://developers.cloudflare.com/pages/)
* [Cloudflare Workers](https://developers.cloudflare.com/workers/)
* PostgreSQL
* Separate API backend (... [Feathers.js](https://feathersjs.com/)? 🤔)
