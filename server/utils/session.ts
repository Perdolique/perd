import {
  useSession,
  getSession,
  updateSession,
  clearSession,
  createError,
  type H3Event,
  type EventHandlerRequest,
  type SessionConfig
} from 'h3'

import { createHttpClient } from '#server/utils/database'
import { getRuntimeDatabaseConfig, getRuntimeSessionSecret } from '#server/utils/config'

declare module 'h3' {
  interface H3EventContext {
    validatedSessionUserId?: string;
  }
}

const sessionCookieName = 'perdSession'

interface SessionData {
  userId?: string;
  sessionVersion?: number;
}

interface SessionIdentity {
  userId: string;
  sessionVersion?: number;
}

function getSessionConfig(event: H3Event) : SessionConfig {
  const secret = getRuntimeSessionSecret(event)

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

async function useAppSession(event: H3Event<EventHandlerRequest>) {
  const config = getSessionConfig(event)

  return useSession<SessionData>(event, config)
}

async function getAppSession(event: H3Event<EventHandlerRequest>) {
  const config = getSessionConfig(event)

  return getSession<SessionData>(event, config)
}

function getSessionDatabase(event: H3Event<EventHandlerRequest>) {
  if (Reflect.has(event.context, 'dbHttp')) {
    return event.context.dbHttp
  }

  const database = createHttpClient(getRuntimeDatabaseConfig(event))

  event.context.dbHttp = database

  return database
}

async function updateAppSession(event: H3Event<EventHandlerRequest>, data: SessionIdentity) {
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
        statusMessage: 'Session is temporarily unavailable'
      })
    }

    const { sessionVersion: currentSessionVersion } = user

    sessionVersion = currentSessionVersion
  }

  const config = getSessionConfig(event)

  return updateSession(event, config, {
    userId,
    sessionVersion
  } satisfies SessionIdentity)
}

async function clearAppSession(event: H3Event<EventHandlerRequest>) {
  const config = getSessionConfig(event)

  return clearSession(event, config)
}

async function validateSessionUser(event: H3Event<EventHandlerRequest>) {
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
