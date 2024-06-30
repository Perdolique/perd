import type { R2Bucket } from "@cloudflare/workers-types";
/**
 * Workaround for https://github.com/cloudflare/workers-sdk/issues/5360
 */
export declare function patchR2Bucket(bucket: R2Bucket): R2Bucket;
