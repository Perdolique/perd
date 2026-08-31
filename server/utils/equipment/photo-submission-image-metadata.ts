import * as v from 'valibot'

const photoSubmissionImageKind = 'equipment-photo-submission'
const photoSubmissionImageRetentionMilliseconds = 24 * 60 * 60 * 1000

const photoSubmissionEnvironmentSchema = v.picklist([
  'development',
  'production',
  'staging'
])

type PhotoSubmissionEnvironment = v.InferOutput<typeof photoSubmissionEnvironmentSchema>

function parsePhotoSubmissionEnvironment(value: unknown): PhotoSubmissionEnvironment {
  return v.parse(photoSubmissionEnvironmentSchema, value)
}

function safeParsePhotoSubmissionEnvironment(
  value: unknown
): PhotoSubmissionEnvironment | null {
  const result = v.safeParse(photoSubmissionEnvironmentSchema, value)

  return result.success ? result.output : null
}

export {
  parsePhotoSubmissionEnvironment,
  photoSubmissionImageKind,
  photoSubmissionImageRetentionMilliseconds,
  safeParsePhotoSubmissionEnvironment
}

export type {
  PhotoSubmissionEnvironment
}
