import * as v from 'valibot'
import type { H3Event, EventHandlerRequest } from 'h3'

export const idValidatorString = v.pipe(v.string(), v.nonEmpty())
export const idValidatorNumber = v.number()

export const stringToIntegerValidator = v.pipe(
  v.string(),
  v.transform(input => Number(input)),
  v.integer()
)

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

export function validateIdString(id: unknown) {
  const { issues, output, success } = v.safeParse(idValidatorString, id)

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

export function validateIdNumber(id: unknown) {
  const { issues, output, success } = v.safeParse(idValidatorNumber, id)

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

export function validateStringToInteger(id: unknown) {
  const { issues, output, success } = v.safeParse(stringToIntegerValidator, id)

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
