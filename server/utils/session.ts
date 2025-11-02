import type { H3Event, EventHandlerRequest, SessionConfig } from 'h3'
import { sessionCookieName } from '~~/constants';
import { validateSessionSecret } from './validate';

interface SessionData {
  userId?: string;
  isAdmin?: boolean;
  lastAdminCheck?: string;
}

function getSessionConfig() : SessionConfig {
  const secret = validateSessionSecret(process.env.SESSION_SECRET);

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

export async function useAppSession(event: H3Event<EventHandlerRequest>) {
  const config = getSessionConfig()

  return useSession<SessionData>(event, config)
}

export async function getAppSession(event: H3Event<EventHandlerRequest>) {
  const config = getSessionConfig()

  return getSession<SessionData>(event, config)
}

export async function updateAppSession(event: H3Event<EventHandlerRequest>, data: SessionData) {
  const config = getSessionConfig()

  return updateSession(event, config, data)
}

export async function clearAppSession(event: H3Event<EventHandlerRequest>) {
  const config = getSessionConfig()

  return clearSession(event, config)
}
