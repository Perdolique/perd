import type { EventHandler, RequestEvent } from 'nuxt/server'

import type {
  RequestBodyOf as NitroRequestBodyOf,
  RequestQueryOf as NitroRequestQueryOf
} from '@nuxt/nitro-server/request-types'

/** Keeps each validator's input shape on a portable handler for generated fetch types. */
type ApiRequestEvent<Request> = RequestEvent & {
  readonly __requestType?: Request;
}

type RequestOf<Handler> = Handler extends (event: infer Event) => unknown
  ? Event extends { readonly __requestType?: infer Request; } ? NonNullable<Request> : never
  : never

type RequestBodyOf<Handler> = [RequestOf<Handler>] extends [never]
  ? NitroRequestBodyOf<Handler>
  : RequestOf<Handler> extends { body: infer Body; } ? Body : never

type RequestQueryOf<Handler> = [RequestOf<Handler>] extends [never]
  ? NitroRequestQueryOf<Handler>
  : RequestOf<Handler> extends { query: infer Query; } ? Query : never

declare module 'nuxt/server' {
  /** Preserve the callback type, including its declared request input. */
  function defineEventHandler<Handler extends EventHandler<unknown>>(handler: Handler): Handler
}

export type { ApiRequestEvent, RequestBodyOf, RequestQueryOf }
