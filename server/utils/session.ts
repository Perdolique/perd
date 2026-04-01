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

import { getRuntimeSessionSecret } from '#server/utils/config'

const sessionCookieName = 'perdSession'

interface SessionData {
  userId?: string;
  isAdmin?: boolean;
}

function getSessionConfig(event: H3Event) : SessionConfig {
  const secret = getRuntimeSessionSecret(event)

  return {
    password: secret,
    name: sessionCookieName,

    cookie: {
      sameSite: 'strict',
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

async function updateAppSession(event: H3Event<EventHandlerRequest>, data: SessionData) {
  const config = getSessionConfig(event)

  return updateSession(event, config, data)
}

async function clearAppSession(event: H3Event<EventHandlerRequest>) {
  const config = getSessionConfig(event)

  return clearSession(event, config)
}

async function validateSessionUser(event: H3Event<EventHandlerRequest>) {
  const session = await useAppSession(event)
  const { userId } = session.data

  if (userId === undefined) {
    throw createError({
      status: 401
    })
  }

  return userId
}

export { useAppSession, getAppSession, updateAppSession, clearAppSession, validateSessionUser }
