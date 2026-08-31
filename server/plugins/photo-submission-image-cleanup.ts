import * as v from 'valibot'
import { defineNitroPlugin } from 'nitropack/runtime'
import { createHttpClient } from '#server/utils/database'
import { nonEmptyStringSchema } from '#server/utils/validation/schemas'
import { optionalBooleanSchema, type DatabaseConfig } from '#server/utils/config-env'

import {
  cleanupPhotoSubmissionImages,
  type PhotoSubmissionImagesBinding
} from '#server/utils/equipment/photo-submission-image-cleanup'

import {
  parsePhotoSubmissionEnvironment,
  type PhotoSubmissionEnvironment
} from '#server/utils/equipment/photo-submission-image-metadata'

import { getPhotoSubmissionImageReferences } from '#server/utils/equipment/photo-submission-image-references'

interface PhotoSubmissionCleanupRuntime {
  databaseConfig: DatabaseConfig;
  environment: PhotoSubmissionEnvironment;
  images: PhotoSubmissionImagesBinding;
}

interface CloudflareScheduledHookPayload {
  controller: ScheduledController;
  context: ExecutionContext;
  env: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPhotoSubmissionImagesBinding(
  value: unknown
): value is PhotoSubmissionImagesBinding {
  if (!isRecord(value) || !isRecord(value.hosted)) {
    return false
  }

  return typeof value.hosted.image === 'function'
    && typeof value.hosted.list === 'function'
}

function getPhotoSubmissionCleanupRuntime(value: unknown): PhotoSubmissionCleanupRuntime {
  if (!isRecord(value)) {
    throw new Error('Cloudflare scheduled environment is unavailable')
  }

  const images = value.IMAGES

  if (!isPhotoSubmissionImagesBinding(images)) {
    throw new Error('Cloudflare Images binding is unavailable')
  }

  const databaseUrl = v.parse(nonEmptyStringSchema, value.NUXT_DATABASE_URL)
  const isLocalDatabase = v.parse(optionalBooleanSchema, value.NUXT_LOCAL_DATABASE)
  const environment = parsePhotoSubmissionEnvironment(value.PHOTO_SUBMISSION_ENVIRONMENT)

  return {
    databaseConfig: {
      databaseUrl,
      isLocalDatabase
    },

    environment,
    images
  }
}

async function runPhotoSubmissionImageCleanup(
  env: unknown,
  scheduledTime: number
): Promise<void> {
  const runtime = getPhotoSubmissionCleanupRuntime(env)
  const database = createHttpClient(runtime.databaseConfig)

  try {
    const summary = await cleanupPhotoSubmissionImages({
      environment: runtime.environment,
      images: runtime.images,

      lookupReferences: async (cloudflareImageIds) => getPhotoSubmissionImageReferences(
        database,
        cloudflareImageIds
      ),

      scheduledTime
    })

    console.info('Photo submission image cleanup completed', {
      environment: runtime.environment,
      summary
    })
  } catch (error) {
    console.error('Photo submission image cleanup failed', {
      environment: runtime.environment,
      error
    })

    throw error
  }
}

// oxlint-disable-next-line import/no-default-export -- Nitro discovers server plugins via default export.
export default defineNitroPlugin((nitroApp) => {
  const handleScheduled = ({
    controller,
    context,
    env
  }: CloudflareScheduledHookPayload): void => {
    context.waitUntil(
      runPhotoSubmissionImageCleanup(env, controller.scheduledTime)
    )
  }

  nitroApp.hooks.hook('cloudflare:scheduled', handleScheduled)
})

export {
  getPhotoSubmissionCleanupRuntime
}
