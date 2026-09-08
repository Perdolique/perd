import { createError, isError, type H3Event } from 'h3'
import { createWebSocketClientFromEvent } from '#server/utils/config'
import { useAppSession } from '#server/utils/session'
import { getSessionUser } from '#server/utils/user'
import { hashToken } from './password'
import type { RegistrationActor, RegistrationDatabase } from './email-registration-persistence'
import { getAuthErrorDetails } from './telemetry'

async function getRegistrationActor(event: H3Event): Promise<RegistrationActor> {
  const user = await getSessionUser(event)

  if (user.userId === null) {
    return {
      userId: null,
      sessionIdHash: null
    }
  }

  const session = await useAppSession(event)

  if (session.id === undefined || session.id === '') {
    throw createError({
      status: 409,
      statusMessage: 'The original account session is required'
    })
  }

  const sessionIdHash = hashToken(session.id)

  return {
    userId: user.userId,
    sessionIdHash
  }
}

/** Own the transaction client's lifetime without turning a close error into a failed activation. */
async function withRegistrationDatabase<Result>(
  event: H3Event,
  sensitiveValues: readonly string[],
  action: (database: RegistrationDatabase) => Promise<Result>
): Promise<Result> {
  const database = createWebSocketClientFromEvent(event)

  try {
    return await action(database)
  } catch (error) {
    const details = getAuthErrorDetails(error, sensitiveValues)

    console.error('Email registration failed', { error: details })

    if (isError(error) && error.statusCode >= 400 && error.statusCode < 500) {
      throw createError({
        status: error.statusCode,
        statusMessage: error.statusMessage
      })
    }

    throw createError({
      status: 503,
      statusMessage: 'Email registration is temporarily unavailable. Try again'
    })
  } finally {
    try {
      await database.$client.end()
    } catch (error) {
      const details = getAuthErrorDetails(error, sensitiveValues)

      console.error('Email registration database close failed', { error: details })
    }
  }
}

export { getRegistrationActor, withRegistrationDatabase }
