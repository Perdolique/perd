import {
  H3Event,
  getRequestHeader as getH3RequestHeader,
  getRequestIP as getH3RequestIP,
  getRequestWebStream
} from 'h3'

import { getRequestHeader, getRequestIP, type RequestEvent, type SessionEvent } from 'nuxt/server'

const sessionEvents = new WeakMap<RequestEvent, SessionEvent>()

/** Reads headers without starting Nitro 2's buffered Node body reader. */
function getRequestMetadataHeader(event: RequestEvent, name: string): string | undefined {
  if (event instanceof H3Event) {
    return getH3RequestHeader(event, name)
  }

  return getRequestHeader(event, name)
}

/** Reads metadata without starting Nitro 2's buffered Node body reader. */
function getRequestMethod(event: RequestEvent): string {
  return event instanceof H3Event ? event.method : event.req.method
}

/** Gives cookie-only session helpers a stable event without starting the Node body reader. */
function getSessionEvent(event: RequestEvent): SessionEvent {
  const response = event.res

  if (!(event instanceof H3Event)) {
    return event
  }

  const cached = sessionEvents.get(event)

  if (cached !== undefined) {
    return cached
  }

  const request = new Request(event.url, { headers: event.headers })

  const sessionEvent = {
    req: request,
    res: response
  }

  sessionEvents.set(event, sessionEvent)

  return sessionEvent
}

/** Keeps bounded reads incremental on Nitro 2, whose portable Node request buffers the body. */
function getRequestBodyStream(event: RequestEvent): ReadableStream<unknown> | undefined {
  if (event instanceof H3Event) {
    return getRequestWebStream(event)
  }

  return event.req.body ?? undefined
}

/** Reads the development connection address when Nitro 2 does not expose it on the Web Request. */
function getDevelopmentClientIP(event: RequestEvent): string | undefined {
  if (event instanceof H3Event) {
    return getH3RequestIP(event, { xForwardedFor: true })
  }

  return getRequestIP(event, { xForwardedFor: true })
}

/** Uses Nitro's request lifetime API, which the portable Nuxt event does not expose yet. */
function scheduleBackgroundTask(event: RequestEvent, task: Promise<unknown>): void {
  if (event instanceof H3Event) {
    event.waitUntil(task)

    return
  }

  throw new Error('The server runtime does not provide background tasks')
}

export { getRequestBodyStream, getDevelopmentClientIP, getRequestMetadataHeader, getRequestMethod, getSessionEvent, scheduleBackgroundTask }
