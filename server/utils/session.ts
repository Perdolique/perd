import { getSessionEvent } from '#server/utils/request-runtime'

import {
  useSession,
  getSession,
  updateSession,
  clearSession,
  createError,
  type SessionConfig,
  type RequestEvent
} from 'nuxt/server'

import { createHttpClient } from '#server/utils/database'
import { getRuntimeDatabaseConfig, getRuntimeSessionSecret } from '#server/utils/config'

declare module 'nuxt/schema' {
  interface RequestEventContext {
    validatedSessionUserId?: string;
  }
}

const sessionCookieName = 'perdSession'

interface SessionData extends Record<string, unknown> {
  userId?: string;
  sessionVersion?: number;
}

interface SessionIdentity {
  userId: string;
  sessionVersion?: number;
}

function getSessionConfig() : SessionConfig {
  const secret = getRuntimeSessionSecret()

  return {
    password: secret,
    name: sessionCookieName,

    cookie: {
      sameSite: 'lax',
      httpOnly: true,
      secure: true
    }
  }
}

async function useAppSession(event: RequestEvent) {
  const config = getSessionConfig()
  const sessionEvent = getSessionEvent(event)

  return useSession<SessionData>(sessionEvent, config)
}

async function getAppSession(event: RequestEvent) {
  const config = getSessionConfig()
  const sessionEvent = getSessionEvent(event)

  return getSession<SessionData>(sessionEvent, config)
}

function getSessionDatabase(event: RequestEvent) {
  if (Reflect.has(event.context, 'dbHttp')) {
    return event.context.dbHttp
  }

  const database = createHttpClient(getRuntimeDatabaseConfig())

  event.context.dbHttp = database

  return database
}

async function updateAppSession(event: RequestEvent, data: SessionIdentity) {
  const { userId } = data
  let { sessionVersion } = data

  if (sessionVersion === undefined) {
    const database = getSessionDatabase(event)

    const user = await database.query.users.findFirst({
      columns: {
        sessionVersion: true
      },

      where: {
        id: userId
      }
    })

    if (user === undefined) {
      throw createError({
        status: 503,
        statusText: 'Session is temporarily unavailable'
      })
    }

    const { sessionVersion: currentSessionVersion } = user

    sessionVersion = currentSessionVersion
  }

  const config = getSessionConfig()
  const sessionEvent = getSessionEvent(event)

  return updateSession(sessionEvent, config, {
    userId,
    sessionVersion
  } satisfies SessionIdentity)
}

async function clearAppSession(event: RequestEvent) {
  const config = getSessionConfig()
  const sessionEvent = getSessionEvent(event)

  return clearSession(sessionEvent, config)
}

async function validateSessionUser(event: RequestEvent) {
  if (event.context.validatedSessionUserId !== undefined) {
    return event.context.validatedSessionUserId
  }

  const session = await useAppSession(event)
  const { userId, sessionVersion = 0 } = session.data

  if (userId === undefined) {
    throw createError({
      status: 401
    })
  }

  const database = getSessionDatabase(event)

  const user = await database.query.users.findFirst({
    columns: {
      sessionVersion: true
    },

    where: {
      id: userId
    }
  })

  if (user === undefined || user.sessionVersion !== sessionVersion) {
    await clearAppSession(event)

    throw createError({
      status: 401
    })
  }

  event.context.validatedSessionUserId = userId

  return userId
}

export type { SessionData }

export {
  useAppSession,
  getAppSession,
  updateAppSession,
  clearAppSession,
  validateSessionUser
}
