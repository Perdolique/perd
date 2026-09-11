import { readFile } from 'node:fs/promises'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { turnstileAlwaysPassSiteKey } from '#shared/utils/turnstile'

const nuxtConfigPath = new URL('../../../nuxt.config.ts', import.meta.url)
const wranglerConfigPath = new URL('../../../wrangler.jsonc', import.meta.url)
const deployedTurnstileSiteKey = '0x4AAAAAAEntzYh6QUh27Ji_'

const rateLimitSchema = v.object({
  name: v.string(),
  namespace_id: v.string(),

  simple: v.object({
    limit: v.number(),
    period: v.number()
  })
})

const secretsSchema = v.object({
  required: v.array(v.string())
})

const sendEmailSchema = v.object({
  allowed_destination_addresses: v.optional(v.array(v.string())),
  allowed_sender_addresses: v.array(v.string()),
  name: v.string()
})

const environmentSchema = v.object({
  name: v.string(),
  ratelimits: v.array(rateLimitSchema),
  secrets: secretsSchema,
  send_email: v.array(sendEmailSchema),
  vars: v.record(v.string(), v.string()),
  workers_dev: v.boolean()
})

const wranglerConfigSchema = v.object({
  env: v.object({
    production: environmentSchema,
    staging: environmentSchema
  }),

  images: v.object({
    binding: v.string(),
    remote: v.optional(v.boolean())
  }),

  name: v.string(),
  ratelimits: v.array(rateLimitSchema),
  secrets: secretsSchema,
  vars: v.record(v.string(), v.string()),
  workers_dev: v.boolean()
})

type WranglerConfig = v.InferOutput<typeof wranglerConfigSchema>

const rateLimitEnvironmentScenarios = [
  {
    emailSignInNamespaceId: '687734013',
    environment: 'development',
    getRateLimits: (config: WranglerConfig) => config.ratelimits,
    guestNamespaceId: '687734004'
  },
  {
    emailSignInNamespaceId: '687734014',
    environment: 'staging',
    getRateLimits: (config: WranglerConfig) => config.env.staging.ratelimits,
    guestNamespaceId: '687734005'
  },
  {
    emailSignInNamespaceId: '687734015',
    environment: 'production',
    getRateLimits: (config: WranglerConfig) => config.env.production.ratelimits,
    guestNamespaceId: '687734006'
  }
] as const

async function readWranglerConfig() {
  const source = await readFile(wranglerConfigPath, 'utf8')
  const rawConfig: unknown = JSON.parse(source)

  return {
    config: v.parse(wranglerConfigSchema, rawConfig),
    source
  }
}

describe('wrangler Cloudflare configuration', () => {
  it('should keep the root worker private and separate from production', async () => {
    const { config } = await readWranglerConfig()

    expect(config.name).toBe('metsik-development')
    expect(config.workers_dev).toBe(false)
    expect(config.env.production.name).toBe('metsik')
    expect(config.env.staging.name).toBe('metsik-staging')
  })

  it('should keep local Images operations in the development mock', async () => {
    const { config } = await readWranglerConfig()

    expect(config.images).toStrictEqual({ binding: 'IMAGES' })
  })

  it('should scope photo submissions and clear deployed maintenance schedules', async () => {
    const { source } = await readWranglerConfig()

    expect(source.match(/"PHOTO_SUBMISSION_ENVIRONMENT"/gu)).toHaveLength(3)
    expect(source).toContain('"PHOTO_SUBMISSION_ENVIRONMENT": "development"')
    expect(source).toContain('"PHOTO_SUBMISSION_ENVIRONMENT": "production"')
    expect(source).toContain('"PHOTO_SUBMISSION_ENVIRONMENT": "staging"')
    expect(source.match(/"crons": \[\]/gu)).toHaveLength(2)
  })

  it.each(rateLimitEnvironmentScenarios)(
    'should configure the $environment Guest limiter namespace',
    async ({ getRateLimits, guestNamespaceId }) => {
      const { config } = await readWranglerConfig()
      const rateLimits = getRateLimits(config)
      const guestRateLimit = rateLimits.find(({ name }) => name === 'GUEST_SESSION_RATE_LIMITER')

      expect(guestRateLimit).toStrictEqual({
        name: 'GUEST_SESSION_RATE_LIMITER',
        namespace_id: guestNamespaceId,

        simple: {
          limit: 5,
          period: 60
        }
      })
    }
  )

  it.each(rateLimitEnvironmentScenarios)(
    'should configure the $environment email sign-in limiter namespace',
    async ({ emailSignInNamespaceId, getRateLimits }) => {
      const { config } = await readWranglerConfig()
      const rateLimits = getRateLimits(config)
      const signInRateLimit = rateLimits.find(({ name }) => name === 'EMAIL_SIGN_IN_RATE_LIMITER')

      expect(signInRateLimit).toStrictEqual({
        name: 'EMAIL_SIGN_IN_RATE_LIMITER',
        namespace_id: emailSignInNamespaceId,

        simple: {
          limit: 5,
          period: 60
        }
      })
    }
  )

  it('should keep email sign-in namespaces unique and enable deployed registration', async () => {
    const { config } = await readWranglerConfig()

    const namespaceIds = rateLimitEnvironmentScenarios.map(({ getRateLimits }) => {
      const rateLimits = getRateLimits(config)
      const signInRateLimit = rateLimits.find(({ name }) => name === 'EMAIL_SIGN_IN_RATE_LIMITER')

      return signInRateLimit?.namespace_id
    })

    expect(new Set(namespaceIds)).toHaveLength(3)
    expect(config.env.production.vars.NUXT_PUBLIC_EMAIL_REGISTRATION_ENABLED).toBe('true')
    expect(config.env.staging.vars.NUXT_PUBLIC_EMAIL_REGISTRATION_ENABLED).toBe('true')
  })

  it('should restrict staging email to the configured recipient', async () => {
    const { config } = await readWranglerConfig()

    expect(config.env.staging.send_email).toStrictEqual([
      {
        allowed_destination_addresses: ['metsik.app@woof.slmail.me'],
        allowed_sender_addresses: ['noreply@metsik.app'],
        name: 'EMAIL'
      }
    ])
  })

  it('should declare every deployed secret required by the Worker', async () => {
    const { config } = await readWranglerConfig()

    const sharedSecrets = [
      'NUXT_DATABASE_URL',
      'NUXT_OAUTH_TWITCH_CLIENT_SECRET',
      'NUXT_SESSION_SECRET',
      'NUXT_TURNSTILE_SECRET'
    ]

    expect(config.secrets.required).toStrictEqual(sharedSecrets)
    expect(config.env.production.secrets.required).toStrictEqual(sharedSecrets)

    expect(config.env.staging.secrets.required).toStrictEqual([
      'NUXT_DATABASE_URL',
      'NUXT_EMAIL_REGISTRATION_STAGING_RECIPIENT',
      'NUXT_OAUTH_TWITCH_CLIENT_SECRET',
      'NUXT_SESSION_SECRET',
      'NUXT_TURNSTILE_SECRET'
    ])
  })

  it('should keep exact deployment-specific Turnstile configuration', async () => {
    const { config } = await readWranglerConfig()

    expect(config.vars).toMatchObject({
      NUXT_PUBLIC_TURNSTILE_SITE_KEY: turnstileAlwaysPassSiteKey,
      NUXT_TURNSTILE_HOSTNAMES: 'localhost,127.0.0.1'
    })

    expect(config.env.production.vars).toMatchObject({
      NUXT_PUBLIC_TURNSTILE_SITE_KEY: deployedTurnstileSiteKey,
      NUXT_TURNSTILE_HOSTNAMES: 'metsik.app'
    })

    expect(config.env.staging.vars).toMatchObject({
      NUXT_PUBLIC_TURNSTILE_SITE_KEY: deployedTurnstileSiteKey,
      NUXT_TURNSTILE_HOSTNAMES: 'staging.metsik.app'
    })

    expect(config.vars).not.toHaveProperty('NUXT_TURNSTILE_SECRET')
    expect(config.env.production.vars).not.toHaveProperty('NUXT_TURNSTILE_SECRET')
    expect(config.env.staging.vars).not.toHaveProperty('NUXT_TURNSTILE_SECRET')
  })

  it('should not bake always-pass Turnstile defaults into Nuxt', async () => {
    const nuxtConfig = await readFile(nuxtConfigPath, 'utf8')

    expect(nuxtConfig).not.toContain('turnstileAlwaysPass')
    expect(nuxtConfig).not.toContain(turnstileAlwaysPassSiteKey)
    expect(nuxtConfig).toContain('hostnames: \'\'')
    expect(nuxtConfig).toContain('secret: \'\'')
    expect(nuxtConfig).toContain('turnstileSiteKey: \'\'')
  })
})
