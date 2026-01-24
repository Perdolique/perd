import consola from 'consola'
import * as v from 'valibot'
import { tables } from '#server/utils/database'
import { createError, defineEventHandler, setResponseStatus, readValidatedBody } from 'h3'
import { limits } from '~~/constants'
import { validateAdmin } from '~~/server/utils/admin'

const bodySchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(limits.maxBrandNameLength)
  ),

  websiteUrl: v.optional(
    v.pipe(
      v.string(),
      v.url(),
    )
  )
})

function validateBody(body: unknown) {
  return v.parse(bodySchema, body)
}

export default defineEventHandler(async (event) => {
  const { db } = event.context
  const { name, websiteUrl } = await readValidatedBody(event, validateBody)

  await validateAdmin(event)

  try {
    const [inserted] = await db
      .insert(tables.brands)
      .values({
        name,
        websiteUrl
      })
      .returning({
        id: tables.brands.id,
        name: tables.brands.name,
        websiteUrl: tables.brands.websiteUrl
      })

    if (inserted === undefined) {
      throw new Error('Failed to create brand')
    }

    setResponseStatus(event, 201)

    return inserted
  } catch (error) {
    consola.error(error)

    throw createError({
      status: 400,
      message: 'Failed to create brand'
    })
  }
})
