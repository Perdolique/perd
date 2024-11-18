import { useRuntimeConfig, getRequestURL } from "#imports";
const _proxy = _getPlatformProxy().catch((error) => {
  console.error("Failed to initialize wrangler bindings proxy", error);
  return _createStubProxy();
}).then((proxy) => {
  globalThis.__env__ = proxy.env;
  return proxy;
});
globalThis.__env__ = _proxy.then((proxy) => proxy.env);
export default (function(nitroApp) {
  nitroApp.hooks.hook("request", async (event) => {
    const proxy = await _proxy;
    event.context.cf = proxy.cf;
    event.context.waitUntil = proxy.ctx.waitUntil;
    const request = new Request(getRequestURL(event));
    request.cf = proxy.cf;
    event.context.cloudflare = {
      ...event.context.cloudflare,
      request,
      env: proxy.env,
      context: proxy.ctx
    };
    event.node.req.__unenv__ = {
      ...event.node.req.__unenv__,
      waitUntil: event.context.waitUntil
    };
  });
  nitroApp.hooks._hooks.request.unshift(nitroApp.hooks._hooks.request.pop());
  nitroApp.hooks.hook("close", () => {
    return _proxy?.then((proxy) => proxy.dispose);
  });
});
async function _getPlatformProxy() {
  const _pkg = "wrangler";
  const { getPlatformProxy } = await import(_pkg).catch(() => {
    throw new Error(
      "Package `wrangler` not found, please install it with: `npx nypm@latest add -D wrangler`"
    );
  });
  const runtimeConfig = useRuntimeConfig();
  const proxy = await getPlatformProxy({
    configPath: runtimeConfig.wrangler.configPath,
    persist: { path: runtimeConfig.wrangler.persistDir },
    environment: runtimeConfig.wrangler.environment
  });
  if (runtimeConfig.wrangler.shamefullyPatchR2Buckets) {
    const { patchR2Bucket } = await import("./r2-patch.mjs");
    for (const [key, binding] of Object.entries(proxy.env)) {
      if (binding.createMultipartUpload) {
        proxy.env[key] = patchR2Bucket(binding);
      }
    }
  }
  return proxy;
}
function _createStubProxy() {
  return {
    env: {},
    cf: {},
    ctx: {
      waitUntil() {
      },
      passThroughOnException() {
      }
    },
    caches: {
      open() {
        const result = Promise.resolve(new _CacheStub());
        return result;
      },
      get default() {
        return new _CacheStub();
      }
    },
    dispose: () => Promise.resolve()
  };
}
class _CacheStub {
  delete() {
    const result = Promise.resolve(false);
    return result;
  }
  match() {
    const result = Promise.resolve(void 0);
    return result;
  }
  put() {
    const result = Promise.resolve();
    return result;
  }
}
