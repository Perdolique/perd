import * as v from 'valibot'
import { createError } from 'nuxt/server'
import { nonEmptyStringSchema } from '#server/utils/validation/schemas'

interface TwitchOAuthConfig {
  clientId: string;
  clientSecret: string;
}

const twitchOAuthConfigSchema = v.object({
  clientId: nonEmptyStringSchema,
  clientSecret: nonEmptyStringSchema
})

function validateTwitchOAuthConfig(config: unknown): TwitchOAuthConfig {
  const result = v.safeParse(twitchOAuthConfigSchema, config)

  if (result.success) {
    return result.output
  }

  throw createError({
    status: 500,
    statusText: 'Twitch OAuth client credentials are not configured'
  })
}

export {
  validateTwitchOAuthConfig
}
