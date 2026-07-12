---
name: nuxt-app
description: Nuxt conventions for framework routing, middleware, SSR data fetching, Nitro handlers, request cancellation, runtime config, and typing. Use whenever work touches a Nuxt app or APIs such as `useFetch`, `useAsyncData`, `useRequestFetch`, `$fetch`, or `definePageMeta`, including requests framed only as Vue SSR or typed internal API work.
---

# Nuxt Conventions

This skill collects conventions for building Nuxt applications. It covers Nuxt runtime behavior, Nitro server routes, data fetching, and typing patterns that rely on Nuxt's build-time integration.

Treat it as the home for Nuxt-specific rules. Non-Nuxt Vue component conventions — component structure, props, emits, styling — belong elsewhere.

## Conventions

Each convention below is a self-contained rule. Apply the rules that match the task. When new Nuxt-specific patterns become stable, add them here as additional sections.

### Import Nuxt APIs from `#imports`

When a Nuxt file needs framework APIs, import them explicitly from `#imports`, never from `#app`.

Rules:

- With auto-imports disabled, every Nuxt composable still needs an explicit import.
- Import Nuxt runtime APIs such as `useRoute`, `useFetch`, `navigateTo`, `definePageMeta`, `useState`, and `useCookie` from `#imports`.
- Do not move this guidance into the Vue component skill. It is Nuxt-specific and belongs here.

### Type internal fetch through the Nitro handler

Nuxt infers response types for its own `/api/...` routes from the Nitro handler's return type. Use that inference instead of duplicating generics at the call site.

Rules:

- Annotate every Nitro handler with an explicit return type, usually `Promise<YourResponse>`.
- Call internal routes with `useFetch('/api/...')` without a response generic.
- When the task needs an imperative internal request, obtain request-aware `$fetch` with `const $fetch = useRequestFetch()` and call it without a response generic.
- Do not import `$fetch` from `ofetch` for internal app-to-app requests.

Why it matters:

- A typed handler gives one source of truth for the response shape. A generic at the call site can drift away from the real payload without any compile-time complaint.
- `useRequestFetch()` forwards the current request context, including headers and cookies, into the app's own routes during SSR. A plain `$fetch` from `ofetch` does not carry that context, so protected internal routes can lose session state.

Example:

```ts
const { data } = await useFetch('/api/profile')

const $fetch = useRequestFetch()

await $fetch('/api/profile', {
  method: 'PATCH',
  body: {
    displayName: 'Ada'
  }
})
```

```ts
interface ProfileResponse {
  displayName: string;
}

export default defineEventHandler(async () : Promise<ProfileResponse> => {
  return {
    displayName: 'Ada'
  }
})
```

Boundary — external HTTP calls:

This convention applies to the app's own internal routes only. External HTTP targets do not participate in Nuxt route inference and do not need `useRequestFetch()` to forward cookies into the app's own API. For them, use the client that fits the integration and type the response at the call site when needed.

```ts
import { $fetch } from 'ofetch'

interface ExternalUserResponse {
  id: string;
}

const user = await $fetch<ExternalUserResponse>('https://example.com/api/user')
```

### Cancel overlapping reactive requests at the transport layer

When rapidly changing route state or filters should cancel stale work, keep one AsyncData entry and explicitly refresh it. A reactive key creates separate entries with separate controllers, so it does not cancel requests started under earlier keys.

Rules:

- Give the logical resource a stable `key` while its reactive query changes.
- Set `watch: false` and call the returned `refresh()` from an explicit Vue `watch` when overlapping changes must cancel the in-flight request. Do not assume the `watch` option proves transport cancellation.
- `useFetch` forwards its controller signal. In a custom `useAsyncData` handler, accept `{ signal }` from the handler context and pass it to the nested `$fetch` call.
- Keep reactive keys when separate responses genuinely need independent cached entries; stable keys are for one replaceable resource.
- Verify cancellation at the network boundary. A correct final UI can also result from ignoring a stale response while the obsolete request still consumes transport and server work.

```ts
const itemsRequest = useFetch('/api/items', {
  key: 'items',
  query,
  watch: false
})

const { refresh } = await itemsRequest

watch(query, async () => {
  await refresh()
})

const requestFetch = useRequestFetch()
const detailRequest = useAsyncData('item-detail', async (_nuxtApp, { signal }) => {
  return requestFetch(`/api/items/${itemId.value}`, { signal })
}, {
  watch: false
})

const { refresh: refreshDetail } = await detailRequest

watch(itemId, async () => {
  await refreshDetail()
})
```

### Register unrecognized platform elements

If Vue resolves a valid platform element as a component, add it to `vue.compilerOptions.isCustomElement` in `nuxt.config.ts`. Verify the rendered page has no hydration or unresolved-component warnings in the browser console.
