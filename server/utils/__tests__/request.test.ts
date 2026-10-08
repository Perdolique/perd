import * as v from 'valibot'
import { createError } from 'nuxt/server'
import { describe, expect, it } from 'vitest'
import { getValidatedRouteParams } from '../request'
import { createTestEvent } from '~~/test-utils/create-test-event'

const slugSchema = v.object({ slug: v.pipe(v.string(), v.minLength(1)) })

describe(getValidatedRouteParams, () => {
  it('decodes the matched segment before validation without decoding path separators', async () => {
    const event = createTestEvent({})

    event.context.params = { slug: 'caf%C3%A9%2Fgear%5Cbag' }

    const result = await getValidatedRouteParams(event, params => v.parse(slugSchema, params))

    expect(result).toStrictEqual({ slug: 'café%2Fgear%5Cbag' })
  })

  it('rejects invalid params with a safe 400 and keeps the validation error as its cause', async () => {
    const event = createTestEvent({})
    const validationError = new Error('Private validation detail')
    const result = getValidatedRouteParams(event, () => { throw validationError })

    await expect(result).rejects.toMatchObject({
      status: 400,
      statusText: 'Validation Error',
      cause: validationError
    })
  })

  it('preserves a deliberate HTTP error from the validator', async () => {
    const event = createTestEvent({})

    const error = createError({
      status: 404,
      statusText: 'Item was not found'
    })

    const result = getValidatedRouteParams(event, () => { throw error })

    await expect(result).rejects.toBe(error)
  })
})
