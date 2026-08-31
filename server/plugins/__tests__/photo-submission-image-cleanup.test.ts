import { describe, expect, it, vi } from 'vitest'
import type { defineNitroPlugin } from 'nitropack/runtime'
import { getPhotoSubmissionCleanupRuntime } from '#server/plugins/photo-submission-image-cleanup'

type DefineNitroPlugin = typeof defineNitroPlugin

const { defineNitroPluginMock } = vi.hoisted(() => {
  return {
    defineNitroPluginMock: vi.fn<DefineNitroPlugin>((plugin) => plugin)
  }
})

vi.mock(import('nitropack/runtime'), () => {
  return {
    defineNitroPlugin: defineNitroPluginMock
  }
})

function createImagesBinding() {
  return {
    hosted: {
      image: vi.fn(),
      list: vi.fn()
    }
  }
}

describe('photo submission image cleanup plugin config', () => {
  it('should parse the scheduled Cloudflare environment', () => {
    const images = createImagesBinding()

    const runtime = getPhotoSubmissionCleanupRuntime({
      IMAGES: images,
      NUXT_DATABASE_URL: 'postgresql://database.example/perd',
      NUXT_LOCAL_DATABASE: 'false',
      PHOTO_SUBMISSION_ENVIRONMENT: 'staging'
    })

    expect(runtime).toStrictEqual({
      databaseConfig: {
        databaseUrl: 'postgresql://database.example/perd',
        isLocalDatabase: false
      },

      environment: 'staging',
      images
    })
  })

  it.each([
    {
      expectedMessage: 'Cloudflare scheduled environment is unavailable',
      value: null
    },
    {
      expectedMessage: 'Cloudflare Images binding is unavailable',

      value: {
        NUXT_DATABASE_URL: 'postgresql://database.example/perd',
        PHOTO_SUBMISSION_ENVIRONMENT: 'production'
      }
    },
    {
      expectedMessage: 'Invalid type',

      value: {
        IMAGES: createImagesBinding(),
        NUXT_DATABASE_URL: 'postgresql://database.example/perd',
        PHOTO_SUBMISSION_ENVIRONMENT: 'preview'
      }
    }
  ])('should reject invalid scheduled config: $expectedMessage', ({
    expectedMessage,
    value
  }) => {
    expect(() => getPhotoSubmissionCleanupRuntime(value)).toThrow(expectedMessage)
  })
})
