import { createHash } from 'node:crypto'

import {
  photoSubmissionImageKind,
  photoSubmissionImageRetentionMilliseconds
} from '#server/utils/equipment/photo-submission-image-metadata'

import type { PhotoSubmissionImageReferences } from '#server/utils/equipment/photo-submission-image-references'

interface CloudflareAuditImage {
  id: string;
  meta?: unknown;
  requireSignedURLs?: boolean;
  uploaded?: string;
}

interface PhotoSubmissionImageAuditSummary {
  candidates: number;
  keptPending: number;
  keptPublished: number;
  keptScoped: number;
  keptTooNew: number;
  keptUnexpectedStatus: number;
  orphanCandidates: number;
  scanned: number;
  skippedInvalid: number;
  terminalCandidates: number;
}

interface PhotoSubmissionImageAuditPlan {
  candidateIds: string[];
  cutoff: string;
  fingerprint: string;
  summary: PhotoSubmissionImageAuditSummary;
}

interface CreateAuditPlanOptions {
  accountId: string;
  images: CloudflareAuditImage[];
  now: number;
  productionReferences: PhotoSubmissionImageReferences;
  stagingReferences: PhotoSubmissionImageReferences;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function createAuditSummary(): PhotoSubmissionImageAuditSummary {
  return {
    candidates: 0,
    keptPending: 0,
    keptPublished: 0,
    keptScoped: 0,
    keptTooNew: 0,
    keptUnexpectedStatus: 0,
    orphanCandidates: 0,
    scanned: 0,
    skippedInvalid: 0,
    terminalCandidates: 0
  }
}

function getAuditFingerprint(accountId: string, candidateIds: string[]): string {
  const hash = createHash('sha256')

  hash.update(accountId)

  for (const candidateId of candidateIds) {
    hash.update('\0')
    hash.update(candidateId)
  }

  return hash.digest('hex')
}

function getCombinedStatuses(
  imageId: string,
  productionReferences: PhotoSubmissionImageReferences,
  stagingReferences: PhotoSubmissionImageReferences
): string[] {
  const statuses: string[] = []
  const productionStatus = productionReferences.submissionStatuses.get(imageId)
  const stagingStatus = stagingReferences.submissionStatuses.get(imageId)

  if (productionStatus !== undefined) {
    statuses.push(productionStatus)
  }

  if (stagingStatus !== undefined) {
    statuses.push(stagingStatus)
  }

  return statuses
}

function isLegacyAuditCandidate(
  image: CloudflareAuditImage,
  cutoff: number,
  summary: PhotoSubmissionImageAuditSummary
): boolean {
  summary.scanned += 1

  if (!isRecord(image.meta) || image.meta.kind !== photoSubmissionImageKind) {
    summary.skippedInvalid += 1

    return false
  }

  if (image.meta.environment !== undefined) {
    summary.keptScoped += 1

    return false
  }

  if (image.requireSignedURLs !== true || image.uploaded === undefined) {
    summary.skippedInvalid += 1

    return false
  }

  const uploadedTime = Date.parse(image.uploaded)

  if (Number.isNaN(uploadedTime)) {
    summary.skippedInvalid += 1

    return false
  }

  if (uploadedTime > cutoff) {
    summary.keptTooNew += 1

    return false
  }

  return true
}

function classifyLegacyCandidate(
  imageId: string,
  productionReferences: PhotoSubmissionImageReferences,
  stagingReferences: PhotoSubmissionImageReferences
): 'orphan' | 'pending' | 'published' | 'terminal' | 'unexpected-status' {
  const isPublished = productionReferences.publishedImageIds.has(imageId)
    || stagingReferences.publishedImageIds.has(imageId)

  if (isPublished) {
    return 'published'
  }

  const statuses = getCombinedStatuses(
    imageId,
    productionReferences,
    stagingReferences
  )

  if (statuses.includes('pending')) {
    return 'pending'
  }

  if (statuses.length === 0) {
    return 'orphan'
  }

  const hasOnlyTerminalStatuses = statuses.every((status) => (
    status === 'approved' || status === 'rejected'
  ))

  return hasOnlyTerminalStatuses ? 'terminal' : 'unexpected-status'
}

function createPhotoSubmissionImageAuditPlan(
  options: CreateAuditPlanOptions
): PhotoSubmissionImageAuditPlan {
  const cutoff = options.now - photoSubmissionImageRetentionMilliseconds
  const summary = createAuditSummary()
  const candidateIds: string[] = []

  for (const image of options.images) {
    if (isLegacyAuditCandidate(image, cutoff, summary)) {
      const classification = classifyLegacyCandidate(
        image.id,
        options.productionReferences,
        options.stagingReferences
      )

      if (classification === 'orphan') {
        candidateIds.push(image.id)
        summary.orphanCandidates += 1
      } else if (classification === 'terminal') {
        candidateIds.push(image.id)
        summary.terminalCandidates += 1
      } else if (classification === 'pending') {
        summary.keptPending += 1
      } else if (classification === 'published') {
        summary.keptPublished += 1
      } else {
        summary.keptUnexpectedStatus += 1
      }
    }
  }

  candidateIds.sort()
  summary.candidates = candidateIds.length

  return {
    candidateIds,
    cutoff: new Date(cutoff).toISOString(),
    fingerprint: getAuditFingerprint(options.accountId, candidateIds),
    summary
  }
}

function validateAuditFingerprint(
  expectedFingerprint: string,
  plan: PhotoSubmissionImageAuditPlan
): void {
  if (expectedFingerprint !== plan.fingerprint) {
    throw new Error(
      `Audit fingerprint changed: expected ${expectedFingerprint}, received ${plan.fingerprint}`
    )
  }
}

export {
  createPhotoSubmissionImageAuditPlan,
  getAuditFingerprint,
  validateAuditFingerprint
}

export type {
  CloudflareAuditImage,
  PhotoSubmissionImageAuditPlan,
  PhotoSubmissionImageAuditSummary
}
