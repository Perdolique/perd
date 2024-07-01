import type { H3Event, EventHandlerRequest } from 'h3'
import { sessionCookieName } from '~~/constants';

interface SessionData {
  userId?: string;
}

export async function useAppSession(event: H3Event<EventHandlerRequest>) {
  return useSession<SessionData>(event, {
    // TODO: use environment variables
    password: 'e2353edd-0a91-4d60-bf3a-715fab5f6c00',
    name: sessionCookieName,

    cookie: {
      sameSite: 'strict'
    }
  })
}
