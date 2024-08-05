import * as v from 'valibot'
import type { H3Event, EventHandlerRequest } from 'h3'

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
  const schema = v.pipe(v.string(), v.nonEmpty())
  const { issues, output, success } = v.safeParse(schema, id)

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
