interface CloudflareEventContext {
  env: Env;
}

declare module 'h3' {
  interface H3EventContext {
    cloudflare?: CloudflareEventContext;
  }
}

export type { CloudflareEventContext }
