/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, getRequestURL, toWebRequest, type H3Event } from 'h3'

// oxlint-disable-next-line import/no-relative-parent-imports -- Standalone test projects need the application context declaration without Nuxt aliases.
import type { RequestEvent } from '../shared/types/request-event'

/** Bridges Node fixtures to portable events while keeping their request and response observable. */
function toTestRequestEvent(event: H3Event): RequestEvent & { node: H3Event['node']; waitUntil: H3Event['waitUntil']; h3: H3Event; } {
  let request: Request | undefined = undefined

  // @ts-expect-error -- Raw fixtures provide only the database methods each test needs.
  const context: RequestEvent['context'] = event.context

  class ResponseHeaders extends globalThis.Headers {
    override set(name: string, value: string): void {
      super.set(name, value)
      event.node.res.setHeader(name, value)
    }

    override append(name: string, value: string): void {
      super.append(name, value)

      const values = name.toLowerCase() === 'set-cookie' ? this.getSetCookie() : this.get(name) ?? ''

      event.node.res.setHeader(name, values)
    }

    override delete(name: string): void {
      super.delete(name)
      event.node.res.removeHeader(name)
    }
  }

  const responseHeaders = new ResponseHeaders()

  const portableEvent = {
    h3: event,

    waitUntil(task: Promise<unknown>) {
      event.waitUntil(task)
    },

    node: event.node,
    context,

    get req() {
      request ??= toWebRequest(event)

      const headers = new globalThis.Headers()
      const nodeHeaderEntries = Object.entries(event.node.req.headers)

      for (const [name, value] of nodeHeaderEntries) {
        if (Array.isArray(value)) {
          for (const item of value) {
            headers.append(name, item)
          }
        } else if (value !== undefined) {
          headers.set(name, value)
        }
      }

      const requestHeaderNames = request.headers.keys()

      for (const name of requestHeaderNames) {
        request.headers.delete(name)
      }

      for (const [name, value] of headers) {
        request.headers.set(name, value)
      }

      Object.assign(request, { context: { clientAddress: event.node.req.socket.remoteAddress } })

      return request
    },

    get url() {
      const url = getRequestURL(event)

      return url
    },

    res: {
      headers: responseHeaders,

      get status() {
        return event.node.res.statusCode
      },

      set status(status: number | undefined) {
        event.node.res.statusCode = status ?? 200
      },

      get statusText() {
        return event.node.res.statusMessage
      },

      set statusText(statusText: string | undefined) {
        event.node.res.statusMessage = statusText ?? ''
      }
    }
  }

  // Nitro 2's portable proxy also keeps the H3 prototype and its transport APIs.
  Object.setPrototypeOf(portableEvent, event)

  return portableEvent
}

function createTestEvent(dbHttp: unknown) {
  const request = new IncomingMessage(new Socket())
  const response = new ServerResponse(request)
  const event = createEvent(request, response)

  Object.assign(event.context, { dbHttp })

  const portableEvent = toTestRequestEvent(event)

  return portableEvent
}

export {
  createTestEvent,
  toTestRequestEvent
}
