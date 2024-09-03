import type { H3Event, EventHandlerRequest, SessionConfig } from 'h3'
import { sessionCookieName } from '~~/constants';

interface SessionData {
  userId?: string;
  isAdmin?: boolean;
  lastAdminCheck?: string;
}

const sessionConfig : SessionConfig = {
  password: process.env.SESSION_SECRET ?? '',
  name: sessionCookieName,

  cookie: {
    sameSite: 'strict',
    httpOnly: true,
    secure: true
  }
}

export async function useAppSession(event: H3Event<EventHandlerRequest>) {
  return useSession<SessionData>(event, sessionConfig)
}

export async function getAppSession(event: H3Event<EventHandlerRequest>) {
  return getSession<SessionData>(event, sessionConfig)
}

export async function updateAppSession(event: H3Event<EventHandlerRequest>, data: SessionData) {
  return updateSession(event, sessionConfig, data)
}

export async function clearAppSession(event: H3Event<EventHandlerRequest>) {
  return clearSession(event, sessionConfig)
}
