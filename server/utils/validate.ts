import * as v from 'valibot'
import type { H3Event, EventHandlerRequest } from 'h3'

export const idValidator = v.pipe(v.string(), v.nonEmpty())

export async function validateSessionUser(event: H3Event<EventHandlerRequest>) {
  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    throw createError({
      statusCode: 401
    })
  }

  return userId
}

export function validateId(id: unknown) {
  const { issues, output, success } = v.safeParse(idValidator, id)

  if (success) {
    return output
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Validation Error',
    message: issues[0].message,
    data: issues
  })
}
