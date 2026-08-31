import { createHttpClient } from '#server/utils/database'

import {
  getPhotoSubmissionImageReferences,
  type PhotoSubmissionImageReferences
} from '#server/utils/equipment/photo-submission-image-references'

import { deleteCloudflareImages, listCloudflarePhotoSubmissionImages } from './cloudflare-photo-submission-images'

import {
  createPhotoSubmissionImageAuditPlan,
  validateAuditFingerprint,
  type PhotoSubmissionImageAuditPlan
} from './photo-submission-image-audit'

import { parseAuditConfig, type PhotoSubmissionImageAuditConfig } from './photo-submission-image-audit-config'

const databaseLookupBatchSize = 500

function chunkValues<Value>(values: Value[], size: number): Value[][] {
  const chunks: Value[][] = []

  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size))
  }

  return chunks
}

function mergeReferences(
  target: PhotoSubmissionImageReferences,
  source: PhotoSubmissionImageReferences
): void {
  for (const imageId of source.publishedImageIds) {
    target.publishedImageIds.add(imageId)
  }

  for (const [imageId, status] of source.submissionStatuses) {
    target.submissionStatuses.set(imageId, status)
  }
}

async function getEnvironmentReferences(
  databaseUrl: string,
  cloudflareImageIds: string[]
): Promise<PhotoSubmissionImageReferences> {
  const database = createHttpClient({
    databaseUrl,
    isLocalDatabase: false
  })

  const batches = chunkValues(cloudflareImageIds, databaseLookupBatchSize)

  const batchReferences = await Promise.all(
    batches.map(async (batch) => getPhotoSubmissionImageReferences(database, batch))
  )

  const references: PhotoSubmissionImageReferences = {
    publishedImageIds: new Set(),
    submissionStatuses: new Map()
  }

  for (const batchReference of batchReferences) {
    mergeReferences(references, batchReference)
  }

  return references
}

async function createCurrentAuditPlan(
  config: PhotoSubmissionImageAuditConfig,
  now: number
): Promise<PhotoSubmissionImageAuditPlan> {
  const images = await listCloudflarePhotoSubmissionImages({
    accountId: config.accountId,
    apiToken: config.apiToken,
    fetchImplementation: fetch
  })

  const imageIds = images.map((image) => image.id)

  const [productionReferences, stagingReferences] = await Promise.all([
    getEnvironmentReferences(config.productionDatabaseUrl, imageIds),
    getEnvironmentReferences(config.stagingDatabaseUrl, imageIds)
  ])

  return createPhotoSubmissionImageAuditPlan({
    accountId: config.accountId,
    images,
    now,
    productionReferences,
    stagingReferences
  })
}

function printAuditResult(label: string, value: unknown): void {
  console.info(label, JSON.stringify(value, null, 2))
}

async function runAudit(): Promise<void> {
  const config = parseAuditConfig(process.argv.slice(2), {
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    PERD_PRODUCTION_DATABASE_URL: process.env.PERD_PRODUCTION_DATABASE_URL,
    PERD_STAGING_DATABASE_URL: process.env.PERD_STAGING_DATABASE_URL
  })

  const plan = await createCurrentAuditPlan(config, Date.now())

  printAuditResult('Photo submission image audit dry-run', plan)

  if (config.applyFingerprint === undefined) {
    return
  }

  validateAuditFingerprint(config.applyFingerprint, plan)

  const deletionSummary = await deleteCloudflareImages({
    accountId: config.accountId,
    apiToken: config.apiToken,
    fetchImplementation: fetch,
    imageIds: plan.candidateIds
  })

  printAuditResult('Photo submission image audit deletion', deletionSummary)

  const verificationPlan = await createCurrentAuditPlan(config, Date.now())

  printAuditResult('Photo submission image audit verification', verificationPlan)

  if (verificationPlan.candidateIds.length > 0) {
    throw new Error(
      `Audit verification still found ${verificationPlan.candidateIds.length} candidate(s)`
    )
  }
}

try {
  await runAudit()
} catch (error) {
  console.error('Photo submission image audit failed', { error })
  process.exitCode = 1
}
