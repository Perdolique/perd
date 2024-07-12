import type { H3Event, EventHandlerRequest } from 'h3'
import { sessionCookieName, sessionSecret } from '~~/constants';

interface SessionData {
  userId?: string;
  isAdmin?: boolean;
  lastAdminCheck?: string;
}

export async function useAppSession(event: H3Event<EventHandlerRequest>) {
  return useSession<SessionData>(event, {
    // TODO: use environment variables
    password: sessionSecret,
    name: sessionCookieName,

    cookie: {
      sameSite: 'strict'
    }
  })
}
