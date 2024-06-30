import { PlatformProxy } from 'wrangler';

declare module "h3" {
    interface H3EventContext {
        cf: PlatformProxy["cf"];
        cloudflare: {
            request: Request & {
                cf: PlatformProxy["cf"];
            };
            env: PlatformProxy["env"];
            context: PlatformProxy["ctx"];
        };
    }
}

declare module "nitropack" {
    interface NitroOptions {
        cloudflareDev?: {
            configPath?: string;
            environmnet?: string;
            persistDir?: string;
            silent?: boolean;
            /** workaround for https://github.com/cloudflare/workers-sdk/issues/5360 */
            shamefullyPatchR2Buckets?: boolean;
        };
    }
}
declare const _default: (arg1: unknown, arg2: unknown) => void;

export { _default as default };
