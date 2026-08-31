import * as v from 'valibot'
import { parseArgs } from 'node:util'
import { nonEmptyStringSchema } from '#server/utils/validation/schemas'

interface PhotoSubmissionImageAuditConfig {
  accountId: string;
  apiToken: string;
  applyFingerprint: string | undefined;
  productionDatabaseUrl: string;
  stagingDatabaseUrl: string;
}

function parseAuditConfig(
  args: string[],
  environment: NodeJS.ProcessEnv
): PhotoSubmissionImageAuditConfig {
  const { values } = parseArgs({
    args,

    options: {
      apply: {
        type: 'string'
      }
    },

    strict: true
  })

  return {
    accountId: v.parse(nonEmptyStringSchema, environment.CLOUDFLARE_ACCOUNT_ID),
    apiToken: v.parse(nonEmptyStringSchema, environment.CLOUDFLARE_API_TOKEN),
    applyFingerprint: values.apply,

    productionDatabaseUrl: v.parse(
      nonEmptyStringSchema,
      environment.PERD_PRODUCTION_DATABASE_URL
    ),

    stagingDatabaseUrl: v.parse(
      nonEmptyStringSchema,
      environment.PERD_STAGING_DATABASE_URL
    )
  }
}

export {
  parseAuditConfig
}

export type {
  PhotoSubmissionImageAuditConfig
}
