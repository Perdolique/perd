import type { createHttpClient } from '#server/utils/database'
import type { CloudflareEventContext } from '#server/types/cloudflare'

declare module 'nuxt/schema' {
  interface RequestEventContext {
    dbHttp: ReturnType<typeof createHttpClient>;
    cloudflare?: CloudflareEventContext;
  }
}

export type { RequestEvent } from 'nuxt/server'
