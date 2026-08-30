import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const wranglerConfigPath = new URL('../../../wrangler.jsonc', import.meta.url)

describe('wrangler Cloudflare Images configuration', () => {
  it('should keep local Images operations in the development mock', async () => {
    const wranglerConfig = await readFile(wranglerConfigPath, 'utf8')
    const imagesConfigStart = wranglerConfig.indexOf('"images"')
    const rateLimitsConfigStart = wranglerConfig.indexOf('"ratelimits"', imagesConfigStart)
    const developmentImagesConfig = wranglerConfig.slice(imagesConfigStart, rateLimitsConfigStart)

    expect(developmentImagesConfig).toContain('"binding": "IMAGES"')
    expect(developmentImagesConfig).not.toContain('"remote": true')
  })
})
