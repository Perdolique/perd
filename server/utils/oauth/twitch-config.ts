import * as v from 'valibot'
import { createError } from 'h3'
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

  if (!result.success) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Twitch OAuth client credentials are not configured'
    })
  }

  return result.output
}

export {
  validateTwitchOAuthConfig
}
