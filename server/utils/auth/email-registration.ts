import { createError, isNuxtError, type RequestEvent } from 'nuxt/server'
import { createRuntimeWebSocketClient } from '#server/utils/config'
import { useAppSession } from '#server/utils/session'
import { getSessionUser } from '#server/utils/user'
import { hashToken } from './password'
import type { RegistrationActor, RegistrationDatabase } from './email-registration-persistence'
import { getAuthErrorDetails } from './telemetry'

async function getRegistrationActor(event: RequestEvent): Promise<RegistrationActor> {
  const user = await getSessionUser(event)

  if (user.userId === null) {
    return {
      userId: null,
      sessionIdHash: null
    }
  }

  const session = await useAppSession(event)

  if (session.id === '') {
    throw createError({
      status: 409,
      statusText: 'The original account session is required'
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
  sensitiveValues: readonly string[],
  action: (database: RegistrationDatabase) => Promise<Result>
): Promise<Result> {
  const database = createRuntimeWebSocketClient()

  try {
    return await action(database)
  } catch (error) {
    const details = getAuthErrorDetails(error, sensitiveValues)

    console.error('Email registration failed', { error: details })

    if (isNuxtError(error) && error.status >= 400 && error.status < 500) {
      throw createError({
        status: error.status,
        statusText: error.statusText
      })
    }

    throw createError({
      status: 503,
      statusText: 'Email registration is temporarily unavailable. Try again'
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
